-- Pesanan: buat pesanan, konfirmasi bayar, batal, geser, menu habis, uang kembali, dan tindakan penjual.
-- Kode error dikirim sebagai pesan exception (contoh 'slot_full') lalu diterjemahkan di aplikasi.

-- Kabar ------------------------------------------------------------------------------------------

-- Waktu buka berikutnya untuk menunda bunyi pesanan yang masuk di luar jam buka (null kalau sedang buka).
create or replace function private.next_open_at(p_tenant uuid, p_now timestamptz default now())
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := private.today_wib(p_now);
  v_now_t time := private.now_wib(p_now)::time;
  r record;
begin
  for d in 0 .. 7 loop
    for r in select * from private.tenant_ranges(p_tenant, v_today + d) order by open_time loop
      if d = 0 and r.open_time <= v_now_t and v_now_t < r.close_time then
        return null;
      end if;
      if d > 0 or r.open_time > v_now_t then
        return private.wib_to_timestamptz(v_today + d, r.open_time);
      end if;
    end loop;
  end loop;
  return null;
end;
$$;

create or replace function private.notify(
  p_user uuid, p_kind text, p_params jsonb, p_url text,
  p_push boolean default true, p_deliver_after timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (user_id, kind, params, url, push_status, deliver_after)
  values (
    p_user, p_kind, coalesce(p_params, '{}'::jsonb), p_url,
    case
      when not p_push then 'tidak_dikirim'
      when p_deliver_after is not null and p_deliver_after > now() then 'ditunda'
      else 'menunggu'
    end,
    p_deliver_after
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Kabar untuk semua anggota tenant. p_quiet menunda push sampai tenant buka kalau sedang di luar jam buka.
create or replace function private.notify_tenant(p_tenant uuid, p_kind text, p_params jsonb, p_url text, p_quiet boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_after timestamptz := case when p_quiet then private.next_open_at(p_tenant) else null end;
  m record;
begin
  for m in select user_id from public.tenant_members where tenant_id = p_tenant loop
    perform private.notify(m.user_id, p_kind, p_params, p_url, true, v_after);
  end loop;
end;
$$;

create or replace function private.notify_team(p_kind text, p_params jsonb, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
begin
  for m in select user_id from public.team_members loop
    perform private.notify(m.user_id, p_kind, p_params, p_url, true, null);
  end loop;
end;
$$;

create or replace function private.order_params(p_order uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'order_id', o.id,
    'number', o.order_number,
    'tenant_name', t.name,
    'pickup_date', o.pickup_date,
    'pickup_time', to_char(o.pickup_time, 'HH24:MI'),
    'pickup_code', o.pickup_code,
    'pickup_name', o.pickup_name
  )
  from public.orders o join public.tenants t on t.id = o.tenant_id
  where o.id = p_order
$$;

create or replace function private.log(p_action text, p_target_type text, p_target uuid, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target, coalesce(p_details, '{}'::jsonb))
$$;

-- Harga dan pilihan tambahan ---------------------------------------------------------------------

-- Menghitung harga satu menu beserta pilihan, dan memeriksa aturan minimal dan maksimal tiap kelompok.
create or replace function private.price_item(p_item uuid, p_option_ids jsonb)
returns table (o_unit int, o_opts jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_price int;
  v_ids uuid[];
  g record;
  v_count int;
begin
  select price into v_price from public.menu_items where id = p_item;
  select coalesce(array_agg(distinct (x)::uuid), '{}') into v_ids from jsonb_array_elements_text(coalesce(p_option_ids, '[]'::jsonb)) x;

  if exists (
    select 1 from unnest(v_ids) oid
    where not exists (
      select 1 from public.options o join public.option_groups og on og.id = o.group_id
      where o.id = oid and og.item_id = p_item and o.is_active
    )
  ) then
    raise exception 'invalid_option';
  end if;

  for g in select * from public.option_groups where item_id = p_item loop
    select count(*) into v_count from public.options o where o.group_id = g.id and o.id = any (v_ids);
    if v_count < g.min_select or v_count > g.max_select then
      raise exception 'invalid_option_count';
    end if;
  end loop;

  o_unit := v_price + coalesce((select sum(o.price_delta) from public.options o where o.id = any (v_ids)), 0);
  select coalesce(jsonb_agg(jsonb_build_object('group', og.name, 'name', o.name, 'price_delta', o.price_delta, 'option_id', o.id)
    order by og.sort_order, o.sort_order), '[]'::jsonb)
    into o_opts
    from public.options o join public.option_groups og on og.id = o.group_id
    where o.id = any (v_ids);
  return next;
end;
$$;

-- Bagian uang kembali sebuah nominal setelah potongan promo, dibulatkan sesuai pembagian promo.
create or replace function private.after_promo(p_order uuid, p_amount int)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case when o.subtotal > 0 and o.promo_discount > 0
    then p_amount - floor(o.promo_discount::numeric * p_amount / o.subtotal)::int
    else p_amount end
  from public.orders o where o.id = p_order
$$;

-- Sumber daya pesanan ----------------------------------------------------------------------------

create or replace function private.release_order_resources(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.orders;
begin
  select * into v from public.orders where id = p_order;
  update public.slot_usage set used = greatest(used - 1, 0)
    where tenant_id = v.tenant_id and pickup_date = v.pickup_date and pickup_time = v.pickup_time;
  update public.daily_counters set orders_count = greatest(orders_count - 1, 0)
    where tenant_id = v.tenant_id and pickup_date = v.pickup_date;
  update public.stock_usage su set used = greatest(su.used - x.qty, 0)
    from (
      select oi.menu_item_id, sum(oi.quantity)::int as qty from public.order_items oi
      where oi.order_id = p_order and oi.status in ('normal', 'habis_menunggu') and oi.menu_item_id is not null
      group by oi.menu_item_id
    ) x
    where su.menu_item_id = x.menu_item_id and su.pickup_date = v.pickup_date;
end;
$$;

-- Menambah stok terpakai per tanggal ambil. Gagal kalau stok harian tidak cukup.
create or replace function private.take_stock(p_item uuid, p_date date, p_qty int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock int;
  v_used int;
begin
  select daily_stock into v_stock from public.menu_items where id = p_item;
  if v_stock is null then
    return;
  end if;
  insert into public.stock_usage as st (menu_item_id, pickup_date, used) values (p_item, p_date, p_qty)
  on conflict (menu_item_id, pickup_date) do update set used = st.used + p_qty
    where st.used + p_qty <= v_stock
  returning st.used into v_used;
  if v_used is null or v_used > v_stock then
    raise exception 'item_sold_out';
  end if;
end;
$$;

-- Uang kembali. tenant_charge mengurangi setoran tenant, jaminin_charge mengurangi pendapatan Jaminin.
create or replace function private.add_refund(
  p_order uuid, p_amount int, p_kind text, p_reason_code text, p_reason_text text,
  p_bearer public.penanggung, p_tenant_charge int, p_jaminin_charge int, p_manual boolean, p_notify boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v public.orders;
begin
  if p_amount <= 0 then
    return null;
  end if;
  select * into v from public.orders where id = p_order for update;
  if v.refunded_total + p_amount > v.total_paid then
    raise exception 'refund_exceeds_paid';
  end if;
  insert into public.refunds (order_id, amount, kind, reason_code, reason_text, bearer, tenant_charge, jaminin_charge, is_manual, created_by)
  values (p_order, p_amount, p_kind, p_reason_code, p_reason_text, p_bearer, p_tenant_charge, p_jaminin_charge, p_manual, auth.uid())
  returning id into v_id;
  update public.orders set refunded_total = refunded_total + p_amount where id = p_order;
  if p_notify then
    perform private.notify(v.buyer_id, 'uang_kembali',
      private.order_params(p_order) || jsonb_build_object('amount', p_amount, 'reason', p_reason_code),
      '/pesanan/' || p_order);
  end if;
  return v_id;
end;
$$;

-- Status akhir untuk pesanan yang belum dibayar.
create or replace function private.expire_order(p_order uuid, p_reason text default 'waktu_habis')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.orders;
begin
  select * into v from public.orders where id = p_order for update;
  if v.status <> 'menunggu_bayar' then
    return;
  end if;
  update public.orders set status = 'kedaluwarsa', end_reason = p_reason where id = p_order;
  update public.payments set status = 'kedaluwarsa' where order_id = p_order;
  perform private.release_order_resources(p_order);
  if p_reason = 'waktu_habis' then
    perform private.notify(v.buyer_id, 'waktu_bayar_habis', private.order_params(p_order), '/pesanan/' || p_order, false);
  end if;
end;
$$;

-- Membatalkan pesanan yang sudah dibayar: uang kembali penuh (dikurangi yang sudah kembali), potongan penjual tidak ditagih.
create or replace function private.cancel_paid_order(p_order uuid, p_reason text, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.orders;
  v_remaining int;
begin
  select * into v from public.orders where id = p_order for update;
  if v.status not in ('diterima', 'disiapkan', 'siap') then
    raise exception 'cannot_cancel';
  end if;
  update public.orders
    set status = 'dibatalkan', end_reason = p_reason, cancelled_at = now(), cancelled_by = p_actor, needs_buyer_action = false
    where id = p_order;
  update public.order_items set resolution_deadline = null where order_id = p_order and status = 'habis_menunggu';
  v_remaining := v.total_paid - v.refunded_total;
  perform private.add_refund(p_order, v_remaining, 'penuh', p_reason, null, 'aturan', 0, 0, false, true);
  perform private.release_order_resources(p_order);
  perform private.notify_tenant(v.tenant_id, 'pesanan_dibatalkan',
    private.order_params(p_order) || jsonb_build_object('reason', p_reason), '/penjual');
  if p_actor is distinct from v.buyer_id then
    perform private.notify(v.buyer_id, 'pesanan_dibatalkan',
      private.order_params(p_order) || jsonb_build_object('reason', p_reason, 'amount', v_remaining), '/pesanan/' || p_order);
  end if;
end;
$$;

-- Membuat pesanan -------------------------------------------------------------------------------

create or replace function public.create_order(
  p_tenant uuid,
  p_pickup_date date,
  p_pickup_time time,
  p_items jsonb,
  p_pickup_name text,
  p_dining public.cara_makan,
  p_cutlery boolean,
  p_note text
)
returns table (order_id uuid, payment_code text, pay_deadline timestamptz, total_paid int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_profile public.profiles;
  v_tenant public.tenants;
  v_settings public.app_settings;
  v_item jsonb;
  v_menu public.menu_items;
  v_qty int;
  v_price record;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_subtotal int := 0;
  v_max_prep int := 0;
  v_slot record;
  v_quota int;
  v_used int;
  v_count int;
  v_promo record;
  v_discount int := 0;
  v_total int;
  v_order uuid;
  v_code text;
  v_deadline timestamptz;
  v_constraint text;
  s record;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.profile_completed_at is null then
    raise exception 'profile_incomplete';
  end if;
  if v_profile.is_suspended then
    raise exception 'account_suspended';
  end if;
  if exists (select 1 from public.orders o where o.buyer_id = v_uid and o.status = 'menunggu_bayar') then
    raise exception 'unpaid_order_exists';
  end if;
  select * into v_tenant from public.tenants where id = p_tenant;
  if v_tenant.id is null or v_tenant.status <> 'disetujui' then
    raise exception 'tenant_unavailable';
  end if;
  if private.is_paused(p_tenant, v_now) then
    raise exception 'tenant_paused';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'cart_empty';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'cart_too_large';
  end if;
  if p_note is not null and length(p_note) > 200 then
    raise exception 'note_too_long';
  end if;
  if p_pickup_name is null or length(trim(p_pickup_name)) = 0 then
    raise exception 'pickup_name_required';
  end if;
  select * into v_settings from public.app_settings where id = 1;

  -- Harga selalu dihitung ulang di server.
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_menu from public.menu_items
      where id = (v_item ->> 'menu_item_id')::uuid and tenant_id = p_tenant;
    if v_menu.id is null or not v_menu.is_active then
      raise exception 'item_unavailable';
    end if;
    if v_menu.sold_out_indefinite or v_menu.sold_out_date = p_pickup_date then
      raise exception 'item_sold_out';
    end if;
    v_qty := coalesce((v_item ->> 'quantity')::int, 1);
    if v_qty < 1 or v_qty > 20 then
      raise exception 'invalid_quantity';
    end if;
    select * into v_price from private.price_item(v_menu.id, coalesce(v_item -> 'option_ids', '[]'::jsonb));
    v_subtotal := v_subtotal + v_price.o_unit * v_qty;
    v_max_prep := greatest(v_max_prep, v_menu.prep_minutes);
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_menu.id, 'name', v_menu.name, 'quantity', v_qty, 'unit_price', v_price.o_unit,
      'prep', v_menu.prep_minutes, 'options', v_price.o_opts
    ));
  end loop;

  -- Jam ambil harus memenuhi rumus jam tercepat, jam buka, dan kuota.
  select * into v_slot from private.slots(p_tenant, p_pickup_date, v_max_prep, v_now) sl where sl.slot_time = p_pickup_time;
  if not found then
    raise exception 'slot_closed';
  end if;
  if v_slot.status = 'lewat' then
    raise exception 'slot_too_soon';
  elsif v_slot.status = 'jeda' then
    raise exception 'tenant_paused';
  elsif v_slot.status = 'batas_harian' then
    raise exception 'daily_limit';
  elsif v_slot.status = 'penuh' then
    raise exception 'slot_full';
  end if;

  -- Kuota dikunci per baris: dua pesanan yang berebut kuota terakhir, hanya satu yang berhasil.
  v_quota := private.slot_quota(p_tenant, p_pickup_time);
  insert into public.slot_usage as su (tenant_id, pickup_date, pickup_time, used)
  values (p_tenant, p_pickup_date, p_pickup_time, 1)
  on conflict (tenant_id, pickup_date, pickup_time)
  do update set used = su.used + 1 where su.used < v_quota
  returning su.used into v_used;
  if v_used is null then
    raise exception 'slot_full';
  end if;

  insert into public.daily_counters as dc (tenant_id, pickup_date, orders_count)
  values (p_tenant, p_pickup_date, 1)
  on conflict (tenant_id, pickup_date)
  do update set orders_count = dc.orders_count + 1
    where v_tenant.daily_order_limit is null or dc.orders_count < v_tenant.daily_order_limit
  returning dc.orders_count into v_count;
  if v_count is null then
    raise exception 'daily_limit';
  end if;

  for s in
    select (l ->> 'menu_item_id')::uuid as mid, sum((l ->> 'quantity')::int)::int as qty
    from jsonb_array_elements(v_lines) l group by 1
  loop
    perform private.take_stock(s.mid, p_pickup_date, s.qty);
  end loop;

  -- Promo jam sepi: pilih yang potongannya paling besar. Persen dibulatkan ke bawah, rupiah tidak melebihi harga.
  select pr.id,
    case when pr.kind = 'persen' then floor(v_subtotal::numeric * pr.value / 100)::int else least(pr.value, v_subtotal) end as discount
    into v_promo
    from public.promos pr
    where pr.tenant_id = p_tenant and pr.is_active
      and extract(isodow from p_pickup_date)::smallint = any (pr.weekdays)
      and pr.start_time <= p_pickup_time and p_pickup_time < pr.end_time
    order by 2 desc
    limit 1;
  if found then
    v_discount := v_promo.discount;
  end if;

  v_total := v_subtotal - v_discount + v_settings.service_fee;
  v_deadline := v_now + make_interval(mins => v_settings.payment_window_minutes);

  loop
    v_code := private.random_code(6);
    begin
      insert into public.orders (
        tenant_id, buyer_id, buyer_name, buyer_whatsapp, pickup_date, pickup_time, pickup_at, pickup_name, dining, cutlery,
        note, subtotal, promo_id, promo_discount, service_fee, seller_fee, total_paid, max_prep_minutes,
        payment_code, pay_deadline
      ) values (
        p_tenant, v_uid, v_profile.full_name, v_profile.whatsapp, p_pickup_date, p_pickup_time,
        private.wib_to_timestamptz(p_pickup_date, p_pickup_time), trim(p_pickup_name), p_dining, coalesce(p_cutlery, false),
        nullif(trim(coalesce(p_note, '')), ''), v_subtotal, case when v_discount > 0 then v_promo.id end, v_discount,
        v_settings.service_fee, v_settings.seller_fee, v_total, v_max_prep, v_code, v_deadline
      )
      returning id into v_order;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'orders_one_unpaid_per_buyer' then
        raise exception 'unpaid_order_exists';
      end if;
    end;
  end loop;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    insert into public.order_items (order_id, menu_item_id, name, quantity, unit_price, line_total, prep_minutes, options)
    values (
      v_order, (v_line ->> 'menu_item_id')::uuid, v_line ->> 'name', (v_line ->> 'quantity')::int,
      (v_line ->> 'unit_price')::int, (v_line ->> 'unit_price')::int * (v_line ->> 'quantity')::int,
      (v_line ->> 'prep')::int, v_line -> 'options'
    );
  end loop;

  insert into public.payments (order_id, code, amount) values (v_order, v_code, v_total);

  order_id := v_order;
  payment_code := v_code;
  pay_deadline := v_deadline;
  total_paid := v_total;
  return next;
end;
$$;

-- Konfirmasi bayar: hanya dipanggil server (Edge Function dengan kunci rahasia). Dipakai simulasi dan nanti penyedia sungguhan.
create or replace function public.internal_confirm_payment(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.orders;
  v_number int;
  v_pickup text;
begin
  select * into v from public.orders where payment_code = upper(trim(p_code)) for update;
  if v.id is null then
    return jsonb_build_object('ok', false, 'error', 'code_not_found');
  end if;
  if v.status <> 'menunggu_bayar' then
    if v.paid_at is not null then
      return jsonb_build_object('ok', true, 'already_paid', true, 'order_id', v.id);
    end if;
    return jsonb_build_object('ok', false, 'error', 'order_not_payable', 'status', v.status);
  end if;
  if now() > v.pay_deadline then
    perform private.expire_order(v.id);
    return jsonb_build_object('ok', false, 'error', 'payment_expired');
  end if;

  update public.daily_counters set last_number = last_number + 1
    where tenant_id = v.tenant_id and pickup_date = v.pickup_date
    returning last_number into v_number;

  loop
    v_pickup := private.random_code(4);
    begin
      update public.orders
        set status = 'diterima', paid_at = now(), order_number = v_number, pickup_code = v_pickup
        where id = v.id;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;
  update public.payments set status = 'lunas', paid_at = now() where order_id = v.id;

  perform private.notify(v.buyer_id, 'pesanan_diterima', private.order_params(v.id), '/pesanan/' || v.id);
  perform private.notify_tenant(v.tenant_id, 'pesanan_baru', private.order_params(v.id), '/penjual', true);
  return jsonb_build_object('ok', true, 'order_id', v.id, 'amount', v.total_paid);
end;
$$;

-- Tindakan pembeli ------------------------------------------------------------------------------

create or replace function public.buyer_cancel_order(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.orders;
begin
  select * into v from public.orders where id = p_order and buyer_id = auth.uid() for update;
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  if v.status = 'menunggu_bayar' then
    perform private.expire_order(v.id, 'dibatalkan_pembeli');
  elsif v.status = 'diterima' then
    perform private.cancel_paid_order(v.id, case when now() >= v.pickup_at then 'belum_siap_jam_ambil' else 'pembeli' end, auth.uid());
  elsif v.status = 'disiapkan' and now() >= v.pickup_at then
    perform private.cancel_paid_order(v.id, 'belum_siap_jam_ambil', auth.uid());
  else
    raise exception 'cannot_cancel';
  end if;
end;
$$;

create or replace function public.buyer_reschedule_order(p_order uuid, p_date date, p_time time)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.orders;
  v_slot record;
  v_quota int;
  v_used int;
  v_count int;
  v_limit int;
  v_number int;
  v_code text;
  s record;
begin
  select * into v from public.orders where id = p_order and buyer_id = auth.uid() for update;
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  if v.status <> 'diterima' then
    raise exception 'cannot_reschedule';
  end if;
  if v.rescheduled_count >= 1 then
    raise exception 'already_rescheduled';
  end if;
  if v.promo_discount > 0 then
    raise exception 'promo_cannot_reschedule';
  end if;
  if v.pickup_date = p_date and v.pickup_time = p_time then
    raise exception 'same_slot';
  end if;

  select * into v_slot from private.slots(v.tenant_id, p_date, v.max_prep_minutes) sl where sl.slot_time = p_time;
  if not found or v_slot.status <> 'tersedia' then
    raise exception 'slot_unavailable';
  end if;

  v_quota := private.slot_quota(v.tenant_id, p_time);
  insert into public.slot_usage as su (tenant_id, pickup_date, pickup_time, used)
  values (v.tenant_id, p_date, p_time, 1)
  on conflict (tenant_id, pickup_date, pickup_time)
  do update set used = su.used + 1 where su.used < v_quota
  returning su.used into v_used;
  if v_used is null then
    raise exception 'slot_full';
  end if;
  update public.slot_usage set used = greatest(used - 1, 0)
    where tenant_id = v.tenant_id and pickup_date = v.pickup_date and pickup_time = v.pickup_time;

  if p_date <> v.pickup_date then
    select daily_order_limit into v_limit from public.tenants where id = v.tenant_id;
    insert into public.daily_counters as dc (tenant_id, pickup_date, orders_count)
    values (v.tenant_id, p_date, 1)
    on conflict (tenant_id, pickup_date)
    do update set orders_count = dc.orders_count + 1 where v_limit is null or dc.orders_count < v_limit
    returning dc.orders_count into v_count;
    if v_count is null then
      raise exception 'daily_limit';
    end if;
    update public.daily_counters set orders_count = greatest(orders_count - 1, 0)
      where tenant_id = v.tenant_id and pickup_date = v.pickup_date;

    for s in
      select oi.menu_item_id as mid, sum(oi.quantity)::int as qty from public.order_items oi
      where oi.order_id = v.id and oi.status in ('normal', 'habis_menunggu') and oi.menu_item_id is not null
      group by oi.menu_item_id
    loop
      perform private.take_stock(s.mid, p_date, s.qty);
      update public.stock_usage set used = greatest(used - s.qty, 0)
        where menu_item_id = s.mid and pickup_date = v.pickup_date;
    end loop;

    update public.daily_counters set last_number = last_number + 1
      where tenant_id = v.tenant_id and pickup_date = p_date
      returning last_number into v_number;
  else
    v_number := v.order_number;
  end if;

  v_code := v.pickup_code;
  loop
    begin
      update public.orders set
        pickup_date = p_date,
        pickup_time = p_time,
        pickup_at = private.wib_to_timestamptz(p_date, p_time),
        order_number = v_number,
        pickup_code = v_code,
        rescheduled_count = rescheduled_count + 1,
        original_pickup_at = coalesce(original_pickup_at, v.pickup_at),
        reminder_sent_at = null,
        not_ready_notified_at = null
      where id = v.id;
      exit;
    exception when unique_violation then
      v_code := private.random_code(4);
    end;
  end loop;

  perform private.notify_tenant(v.tenant_id, 'jam_ambil_digeser',
    private.order_params(v.id) || jsonb_build_object('old_time', to_char(v.pickup_time, 'HH24:MI'), 'old_date', v.pickup_date),
    '/penjual');
  perform private.notify(v.buyer_id, 'jam_ambil_digeser', private.order_params(v.id), '/pesanan/' || v.id, false);
end;
$$;

create or replace function public.buyer_confirm_received(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.orders;
begin
  select * into v from public.orders where id = p_order and buyer_id = auth.uid() for update;
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  if v.status not in ('disiapkan', 'siap') then
    raise exception 'not_ready_yet';
  end if;
  if v.needs_buyer_action then
    raise exception 'resolve_sold_out_first';
  end if;
  update public.orders set status = 'selesai', completed_at = now(), completed_by = 'pembeli',
    ready_at = coalesce(ready_at, now()) where id = v.id;
end;
$$;

-- Menu habis: pembeli memilih ganti (sama atau lebih murah), hapus, atau batal semua.
create or replace function private.remove_item(p_item uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  it public.order_items;
  v public.orders;
  v_amount int;
begin
  select * into it from public.order_items where id = p_item for update;
  select * into v from public.orders where id = it.order_id for update;
  update public.order_items set status = 'dihapus', resolution_deadline = null where id = p_item;
  if it.menu_item_id is not null then
    update public.stock_usage set used = greatest(used - it.quantity, 0)
      where menu_item_id = it.menu_item_id and pickup_date = v.pickup_date;
  end if;

  if not exists (select 1 from public.order_items where order_id = v.id and status in ('normal', 'habis_menunggu')) then
    perform private.cancel_paid_order(v.id, 'semua_menu_habis', null);
    return;
  end if;

  v_amount := private.after_promo(v.id, it.line_total);
  update public.order_items set refunded_amount = v_amount where id = p_item;
  perform private.add_refund(v.id, v_amount, 'sebagian', p_reason, it.name, 'aturan', v_amount, 0, false, true);
  update public.orders set needs_buyer_action = exists (
    select 1 from public.order_items where order_id = v.id and status = 'habis_menunggu'
  ) where id = v.id;
end;
$$;

create or replace function public.buyer_resolve_sold_out(
  p_order_item uuid, p_action text, p_replacement uuid default null, p_option_ids jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  it public.order_items;
  v public.orders;
  v_menu public.menu_items;
  v_price record;
  v_new uuid;
  v_diff int;
  v_amount int;
begin
  select * into it from public.order_items where id = p_order_item for update;
  select * into v from public.orders where id = it.order_id and buyer_id = auth.uid() for update;
  if v.id is null or it.status <> 'habis_menunggu' then
    raise exception 'nothing_to_resolve';
  end if;
  if v.status not in ('diterima', 'disiapkan') then
    raise exception 'order_not_active';
  end if;

  if p_action = 'batal' then
    perform private.cancel_paid_order(v.id, 'pembeli_menu_habis', auth.uid());
  elsif p_action = 'hapus' then
    perform private.remove_item(it.id, 'menu_habis_dihapus');
  elsif p_action = 'ganti' then
    select * into v_menu from public.menu_items where id = p_replacement and tenant_id = v.tenant_id;
    if v_menu.id is null or not v_menu.is_active or v_menu.sold_out_indefinite or v_menu.sold_out_date = v.pickup_date
       or v_menu.id = it.menu_item_id then
      raise exception 'replacement_unavailable';
    end if;
    select * into v_price from private.price_item(v_menu.id, coalesce(p_option_ids, '[]'::jsonb));
    if v_price.o_unit > it.unit_price then
      raise exception 'replacement_too_expensive';
    end if;
    perform private.take_stock(v_menu.id, v.pickup_date, it.quantity);
    if it.menu_item_id is not null then
      update public.stock_usage set used = greatest(used - it.quantity, 0)
        where menu_item_id = it.menu_item_id and pickup_date = v.pickup_date;
    end if;
    insert into public.order_items (order_id, menu_item_id, name, quantity, unit_price, line_total, prep_minutes, options, replaces_item_id)
    values (v.id, v_menu.id, v_menu.name, it.quantity, v_price.o_unit, v_price.o_unit * it.quantity, v_menu.prep_minutes, v_price.o_opts, it.id)
    returning id into v_new;
    update public.order_items set status = 'diganti', resolution_deadline = null where id = it.id;
    v_diff := (it.unit_price - v_price.o_unit) * it.quantity;
    if v_diff > 0 then
      v_amount := private.after_promo(v.id, v_diff);
      update public.order_items set refunded_amount = v_amount where id = it.id;
      perform private.add_refund(v.id, v_amount, 'sebagian', 'menu_habis_diganti', it.name, 'aturan', v_amount, 0, false, true);
    end if;
    update public.orders set
      needs_buyer_action = exists (select 1 from public.order_items where order_id = v.id and status = 'habis_menunggu'),
      max_prep_minutes = greatest(max_prep_minutes, v_menu.prep_minutes)
      where id = v.id;
  else
    raise exception 'invalid_action';
  end if;

  perform private.notify_tenant(v.tenant_id, 'pilihan_menu_habis',
    private.order_params(v.id) || jsonb_build_object('item', it.name, 'action', p_action), '/penjual');
end;
$$;

-- Tindakan penjual -----------------------------------------------------------------------------

create or replace function private.require_member(p_tenant uuid)
returns public.peran_tenant
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.peran_tenant;
begin
  select role into v_role from public.tenant_members where tenant_id = p_tenant and user_id = auth.uid();
  if v_role is null then
    raise exception 'not_tenant_member';
  end if;
  return v_role;
end;
$$;

create or replace function public.seller_update_status(p_order uuid, p_status public.status_pesanan)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.orders;
begin
  select * into v from public.orders where id = p_order for update;
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  perform private.require_member(v.tenant_id);
  if v.pickup_date <> private.today_wib() then
    raise exception 'not_pickup_day';
  end if;

  if p_status = 'disiapkan' then
    if v.status <> 'diterima' then
      raise exception 'invalid_transition';
    end if;
    update public.orders set status = 'disiapkan', preparing_at = now() where id = v.id;
    perform private.notify(v.buyer_id, 'mulai_disiapkan', private.order_params(v.id), '/pesanan/' || v.id);
  elsif p_status = 'siap' then
    if v.status not in ('diterima', 'disiapkan') then
      raise exception 'invalid_transition';
    end if;
    if v.needs_buyer_action then
      raise exception 'waiting_buyer_choice';
    end if;
    update public.orders set status = 'siap', ready_at = now(), preparing_at = coalesce(preparing_at, now()) where id = v.id;
    perform private.notify(v.buyer_id, 'siap_diambil', private.order_params(v.id), '/pesanan/' || v.id);
  else
    raise exception 'invalid_transition';
  end if;
end;
$$;

-- Tahap sekaligus untuk semua pesanan di satu jam ambil. Pesanan yang belum bisa dipindah dilewati.
create or replace function public.seller_update_slot(p_tenant uuid, p_date date, p_time time, p_status public.status_pesanan)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
  v_done int := 0;
begin
  perform private.require_member(p_tenant);
  for o in
    select id from public.orders
    where tenant_id = p_tenant and pickup_date = p_date and pickup_time = p_time
      and ((p_status = 'disiapkan' and status = 'diterima')
        or (p_status = 'siap' and status in ('diterima', 'disiapkan') and not needs_buyer_action))
  loop
    perform public.seller_update_status(o.id, p_status);
    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$$;

create or replace function public.seller_handover(p_order uuid, p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.orders;
begin
  select * into v from public.orders where id = p_order for update;
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  perform private.require_member(v.tenant_id);
  if v.status not in ('diterima', 'disiapkan', 'siap') then
    raise exception 'invalid_transition';
  end if;
  if v.pickup_date <> private.today_wib() then
    raise exception 'not_pickup_day';
  end if;
  if upper(trim(coalesce(p_code, ''))) <> v.pickup_code then
    raise exception 'wrong_pickup_code';
  end if;
  if v.needs_buyer_action then
    raise exception 'waiting_buyer_choice';
  end if;
  update public.orders set status = 'selesai', completed_at = now(), completed_by = 'penjual',
    ready_at = coalesce(ready_at, now()), preparing_at = coalesce(preparing_at, now())
    where id = v.id;
end;
$$;

-- Mencari pesanan hari ini dari kode ambil (dipakai saat penjual mengetik kode).
create or replace function public.seller_find_by_code(p_tenant uuid, p_code text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.require_member(p_tenant);
  select id into v_id from public.orders
    where tenant_id = p_tenant and pickup_date = private.today_wib() and pickup_code = upper(trim(p_code));
  return v_id;
end;
$$;

-- Menandai satu menu habis di pesanan yang sudah dibayar. Pembeli punya 10 menit atau sampai jam ambil untuk memilih.
create or replace function public.seller_flag_item_sold_out(p_order_item uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  it public.order_items;
  v public.orders;
  v_minutes int;
begin
  select * into it from public.order_items where id = p_order_item for update;
  select * into v from public.orders where id = it.order_id for update;
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  perform private.require_member(v.tenant_id);
  if v.status not in ('diterima', 'disiapkan') or it.status <> 'normal' then
    raise exception 'invalid_transition';
  end if;
  select sold_out_response_minutes into v_minutes from public.app_settings where id = 1;
  update public.order_items set status = 'habis_menunggu', sold_out_flagged_at = now(),
    resolution_deadline = least(now() + make_interval(mins => v_minutes), v.pickup_at)
    where id = it.id;
  update public.orders set needs_buyer_action = true where id = v.id;
  perform private.notify(v.buyer_id, 'menu_habis',
    private.order_params(v.id) || jsonb_build_object('item', it.name, 'item_id', it.id), '/pesanan/' || v.id);
end;
$$;

-- Tanda habis pada menu: hari ini saja, sampai dibuka lagi, atau tersedia. Mengembalikan pesanan lunas yang berisi menu itu.
create or replace function public.seller_set_menu_availability(p_item uuid, p_mode text)
returns table (order_id uuid, order_number int, pickup_date date, pickup_time time, order_item_id uuid, quantity int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_today date := private.today_wib();
begin
  select tenant_id into v_tenant from public.menu_items where id = p_item;
  if v_tenant is null then
    raise exception 'item_not_found';
  end if;
  perform private.require_member(v_tenant);
  if p_mode = 'hari_ini' then
    update public.menu_items set sold_out_date = v_today, sold_out_indefinite = false where id = p_item;
  elsif p_mode = 'sampai_dibuka' then
    update public.menu_items set sold_out_indefinite = true where id = p_item;
  elsif p_mode = 'tersedia' then
    update public.menu_items set sold_out_date = null, sold_out_indefinite = false where id = p_item;
    return;
  else
    raise exception 'invalid_action';
  end if;

  return query
    select o.id, o.order_number, o.pickup_date, o.pickup_time, oi.id, oi.quantity
    from public.order_items oi join public.orders o on o.id = oi.order_id
    where oi.menu_item_id = p_item and oi.status = 'normal'
      and o.status in ('diterima', 'disiapkan')
      and (o.pickup_date = v_today or (p_mode = 'sampai_dibuka' and o.pickup_date > v_today))
    order by o.pickup_date, o.pickup_time, o.order_number;
end;
$$;

-- Tutup sementara: 15, 30, atau 60 menit, sampai dibuka lagi (0 = tanpa batas), atau buka kembali (null).
create or replace function public.seller_pause(p_tenant uuid, p_minutes int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_member(p_tenant);
  if p_minutes is null then
    update public.tenants set paused_until = null, paused_indefinitely = false where id = p_tenant;
  elsif p_minutes = 0 then
    update public.tenants set paused_until = null, paused_indefinitely = true where id = p_tenant;
  elsif p_minutes in (15, 30, 60) then
    update public.tenants set paused_until = now() + make_interval(mins => p_minutes), paused_indefinitely = false where id = p_tenant;
  else
    raise exception 'invalid_duration';
  end if;
end;
$$;

-- Hak jalankan: fungsi API untuk pengguna masuk, fungsi internal hanya untuk server.
revoke execute on function public.internal_confirm_payment(text) from public, anon, authenticated;
grant execute on function public.internal_confirm_payment(text) to service_role;

grant execute on function
  public.create_order(uuid, date, time, jsonb, text, public.cara_makan, boolean, text),
  public.buyer_cancel_order(uuid),
  public.buyer_reschedule_order(uuid, date, time),
  public.buyer_confirm_received(uuid),
  public.buyer_resolve_sold_out(uuid, text, uuid, jsonb),
  public.seller_update_status(uuid, public.status_pesanan),
  public.seller_update_slot(uuid, date, time, public.status_pesanan),
  public.seller_handover(uuid, text),
  public.seller_find_by_code(uuid, text),
  public.seller_flag_item_sold_out(uuid),
  public.seller_set_menu_availability(uuid, text),
  public.seller_pause(uuid, int)
  to authenticated;
revoke execute on function
  public.create_order(uuid, date, time, jsonb, text, public.cara_makan, boolean, text),
  public.buyer_cancel_order(uuid),
  public.buyer_reschedule_order(uuid, date, time),
  public.buyer_confirm_received(uuid),
  public.buyer_resolve_sold_out(uuid, text, uuid, jsonb),
  public.seller_update_status(uuid, public.status_pesanan),
  public.seller_update_slot(uuid, date, time, public.status_pesanan),
  public.seller_handover(uuid, text),
  public.seller_find_by_code(uuid, text),
  public.seller_flag_item_sold_out(uuid),
  public.seller_set_menu_availability(uuid, text),
  public.seller_pause(uuid, int)
  from public, anon;
