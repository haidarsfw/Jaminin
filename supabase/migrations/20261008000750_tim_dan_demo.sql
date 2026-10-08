-- Lanjutan migrasi 700: anggota tim, biaya, mode demo, data contoh, dan hak jalankan fungsi API.

-- Tim: anggota tim ---------------------------------------------------------------------------------

create or replace function public.team_list_members()
returns table (user_id uuid, full_name text, email text, role public.peran_tim, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_team();
  return query
    select tm.user_id, p.full_name, u.email::text, tm.role, tm.created_at
    from public.team_members tm join public.profiles p on p.id = tm.user_id join auth.users u on u.id = tm.user_id
    order by tm.created_at;
end;
$$;

create or replace function public.team_add_member(p_email text, p_role public.peran_tim)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  perform private.require_admin();
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'account_not_found';
  end if;
  insert into public.team_members (user_id, role, added_by) values (v_user, p_role, auth.uid())
  on conflict (user_id) do update set role = excluded.role;
  perform private.log('tambah_anggota_tim', 'profile', v_user, jsonb_build_object('role', p_role));
end;
$$;

-- Admin terakhir tidak bisa dihapus atau diturunkan supaya tim tidak terkunci.
create or replace function public.team_update_member(p_user uuid, p_role public.peran_tim)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_role is distinct from 'admin'
     and exists (select 1 from public.team_members where user_id = p_user and role = 'admin')
     and (select count(*) from public.team_members where role = 'admin') <= 1 then
    raise exception 'last_admin';
  end if;
  if p_role is null then
    delete from public.team_members where user_id = p_user;
    perform private.log('hapus_anggota_tim', 'profile', p_user, '{}'::jsonb);
  else
    update public.team_members set role = p_role where user_id = p_user;
    perform private.log('ubah_peran_tim', 'profile', p_user, jsonb_build_object('role', p_role));
  end if;
end;
$$;

create or replace function public.admin_update_fees(p_service_fee int, p_seller_fee int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_service_fee < 0 or p_seller_fee < 0 then
    raise exception 'invalid_amount';
  end if;
  update public.app_settings set service_fee = p_service_fee, seller_fee = p_seller_fee, updated_at = now() where id = 1;
  perform private.log('ubah_biaya', 'settings', null, jsonb_build_object('service_fee', p_service_fee, 'seller_fee', p_seller_fee));
end;
$$;

-- Mode demo ----------------------------------------------------------------------------------------

create or replace function private.can_use_demo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_team() or exists (select 1 from public.profiles where id = auth.uid() and is_demo)
$$;

create or replace function public.demo_panel()
returns table (user_id uuid, email text, full_name text, demo_role text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_use_demo() then
    raise exception 'not_team';
  end if;
  return query
    select p.id, u.email::text, p.full_name, coalesce(u.raw_app_meta_data ->> 'demo_role', 'lainnya')
    from public.profiles p join auth.users u on u.id = p.id
    where p.is_demo
    order by coalesce((u.raw_app_meta_data ->> 'demo_order')::int, 99);
end;
$$;

create or replace function public.demo_set_mode(p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_use_demo() then
    raise exception 'not_team';
  end if;
  update public.app_settings set demo_mode = p_on, updated_at = now() where id = 1;
  perform private.log('mode_demo', 'settings', null, jsonb_build_object('on', p_on));
end;
$$;

-- Pesanan contoh untuk dasbor (berlabel data contoh), beberapa hari ke belakang.
create or replace function private.seed_sample_orders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer uuid;
  t record;
  d int;
  k int;
  v_item record;
  v_order uuid;
  v_date date;
  v_time time;
  v_status public.status_pesanan;
  v_number int;
  v_settings public.app_settings;
  v_qty int;
begin
  select id into v_buyer from public.profiles where is_demo order by created_at limit 1;
  if v_buyer is null then
    return;
  end if;
  select * into v_settings from public.app_settings where id = 1;
  for t in select id from public.tenants where is_sample and status = 'disetujui' loop
    for d in 1 .. 6 loop
      v_date := private.today_wib() - d;
      continue when extract(isodow from v_date) > 5;
      v_number := 0;
      for k in 1 .. 2 + (abs(hashtext(t.id::text || d::text)) % 3) loop
        select * into v_item from public.menu_items where tenant_id = t.id and is_active order by md5(id::text || d::text || k::text) limit 1;
        continue when v_item.id is null;
        v_number := v_number + 1;
        v_time := (time '09:05' + make_interval(mins => 120 * ((k - 1) % 4)));
        v_qty := 1 + (k % 2);
        v_status := case when k % 7 = 0 then 'dibatalkan' when k % 9 = 0 then 'tidak_diambil' else 'selesai' end;
        insert into public.orders (
          tenant_id, buyer_id, buyer_name, buyer_whatsapp, pickup_date, pickup_time, pickup_at, pickup_name, dining, cutlery,
          status, end_reason, subtotal, service_fee, seller_fee, total_paid, refunded_total, max_prep_minutes,
          payment_code, pay_deadline, pickup_code, order_number, paid_at, preparing_at, ready_at, completed_at, completed_by,
          cancelled_at, is_sample, created_at
        ) values (
          t.id, v_buyer, 'Pembeli Contoh', null, v_date, v_time, private.wib_to_timestamptz(v_date, v_time), 'Pembeli Contoh',
          'bungkus', false, v_status, case when v_status = 'dibatalkan' then 'pembeli' end,
          v_item.price * v_qty, v_settings.service_fee, v_settings.seller_fee, v_item.price * v_qty + v_settings.service_fee,
          case when v_status = 'dibatalkan' then v_item.price * v_qty + v_settings.service_fee else 0 end,
          v_item.prep_minutes, private.random_code(6), private.wib_to_timestamptz(v_date, v_time) - interval '30 minutes',
          private.random_code(4), v_number, private.wib_to_timestamptz(v_date, v_time) - interval '28 minutes',
          case when v_status <> 'dibatalkan' then private.wib_to_timestamptz(v_date, v_time) - interval '15 minutes' end,
          case when v_status <> 'dibatalkan' then private.wib_to_timestamptz(v_date, v_time) - interval '2 minutes' end,
          case when v_status = 'selesai' then private.wib_to_timestamptz(v_date, v_time) + interval '3 minutes' end,
          case when v_status = 'selesai' then 'penjual' end,
          case when v_status = 'dibatalkan' then private.wib_to_timestamptz(v_date, v_time) - interval '25 minutes' end,
          true, private.wib_to_timestamptz(v_date, v_time) - interval '30 minutes'
        ) returning id into v_order;
        insert into public.order_items (order_id, menu_item_id, name, quantity, unit_price, line_total, prep_minutes)
        values (v_order, v_item.id, v_item.name, v_qty, v_item.price, v_item.price * v_qty, v_item.prep_minutes);
        insert into public.payments (order_id, code, amount, status, paid_at)
        select v_order, o.payment_code, o.total_paid, 'lunas', o.paid_at from public.orders o where o.id = v_order;
        if v_status = 'dibatalkan' then
          insert into public.refunds (order_id, amount, kind, reason_code, bearer)
          select v_order, o.total_paid, 'penuh', 'pembeli', 'aturan' from public.orders o where o.id = v_order;
        end if;
      end loop;
    end loop;
  end loop;
  -- Setoran contoh untuk hari-hari yang lalu, tanpa mengirim kabar.
  for t in select id from public.tenants where is_sample and status = 'disetujui' loop
    for d in reverse 6 .. 1 loop
      v_date := private.today_wib() - d;
      continue when exists (select 1 from public.payouts where tenant_id = t.id and payout_date = v_date);
      perform private.create_payout_quiet(t.id, v_date);
    end loop;
  end loop;
end;
$$;

create or replace function private.create_payout_quiet(p_tenant uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_gross int;
  v_promo int;
  v_fee int;
  v_bank public.tenant_bank;
  v_id uuid;
begin
  select count(*)::int, coalesce(sum(subtotal), 0)::int, coalesce(sum(promo_discount), 0)::int, coalesce(sum(seller_fee), 0)::int
    into v_count, v_gross, v_promo, v_fee
    from public.orders where tenant_id = p_tenant and status in ('selesai', 'tidak_diambil') and payout_id is null and pickup_date <= p_date;
  if v_count = 0 then
    return;
  end if;
  select * into v_bank from public.tenant_bank where tenant_id = p_tenant;
  insert into public.payouts (tenant_id, payout_date, orders_count, gross_sales, promo_total, seller_fee_total, refunds_charged,
    amount, bank_name, account_number, account_holder, is_sample, sent_at)
  values (p_tenant, p_date, v_count, v_gross, v_promo, v_fee, 0, v_gross - v_promo - v_fee,
    v_bank.bank_name, v_bank.account_number, v_bank.account_holder, true,
    private.wib_to_timestamptz(p_date, coalesce(private.tenant_last_close(p_tenant, p_date), time '17:00')))
  returning id into v_id;
  update public.orders set payout_id = v_id
    where tenant_id = p_tenant and status in ('selesai', 'tidak_diambil') and payout_id is null and pickup_date <= p_date;
end;
$$;

-- Menyusun ulang penghitung kuota, stok, dan nomor urut dari pesanan yang tersisa.
-- Penghitung disetel ke nol lalu diisi ulang, sehingga baris lama tidak perlu dihapus.
create or replace function private.rebuild_counters(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.slot_usage set used = 0 where tenant_id = p_tenant;
  insert into public.slot_usage as su (tenant_id, pickup_date, pickup_time, used)
    select tenant_id, pickup_date, pickup_time, count(*)::int from public.orders
    where tenant_id = p_tenant and status in ('menunggu_bayar', 'diterima', 'disiapkan', 'siap', 'selesai', 'tidak_diambil')
    group by tenant_id, pickup_date, pickup_time
  on conflict (tenant_id, pickup_date, pickup_time) do update set used = excluded.used;
  update public.daily_counters set last_number = 0, orders_count = 0 where tenant_id = p_tenant;
  insert into public.daily_counters as dc (tenant_id, pickup_date, last_number, orders_count)
    select tenant_id, pickup_date, coalesce(max(order_number), 0),
      (count(*) filter (where status in ('menunggu_bayar', 'diterima', 'disiapkan', 'siap', 'selesai', 'tidak_diambil')))::int
    from public.orders where tenant_id = p_tenant group by tenant_id, pickup_date
  on conflict (tenant_id, pickup_date) do update set last_number = excluded.last_number, orders_count = excluded.orders_count;
  update public.stock_usage set used = 0 where menu_item_id in (select id from public.menu_items where tenant_id = p_tenant);
  insert into public.stock_usage as st (menu_item_id, pickup_date, used)
    select oi.menu_item_id, o.pickup_date, sum(oi.quantity)::int
    from public.order_items oi join public.orders o on o.id = oi.order_id
    where o.tenant_id = p_tenant and oi.menu_item_id is not null and oi.status in ('normal', 'habis_menunggu')
      and o.status in ('menunggu_bayar', 'diterima', 'disiapkan', 'siap', 'selesai', 'tidak_diambil')
    group by oi.menu_item_id, o.pickup_date
  on conflict (menu_item_id, pickup_date) do update set used = excluded.used;
end;
$$;

-- Penghapusan untuk reset demo dan data contoh, satu tabel per fungsi.
create or replace function private.purge_sample_payouts()
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.payouts where tenant_id in (select id from public.tenants where is_sample) $$;

create or replace function private.purge_demo_orders()
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.orders where is_sample or buyer_id in (select id from public.profiles where is_demo) $$;

create or replace function private.purge_demo_notifications()
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.notifications where user_id in (select id from public.profiles where is_demo) $$;

create or replace function private.purge_sample_tenant_orders()
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.orders where tenant_id in (select id from public.tenants where is_sample) $$;

create or replace function private.purge_sample_tenants()
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.tenants where is_sample $$;

-- Reset demo: hanya pesanan dan turunannya milik akun demo serta data contoh. Data pengguna asli tidak tersentuh.
create or replace function public.demo_reset()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  if not private.can_use_demo() then
    raise exception 'not_team';
  end if;
  perform private.purge_sample_payouts();
  perform private.purge_demo_orders();
  perform private.purge_demo_notifications();
  update public.menu_items set sold_out_date = null, sold_out_indefinite = false
    where tenant_id in (select id from public.tenants where is_sample);
  update public.tenants set paused_until = null, paused_indefinitely = false where is_sample;
  for t in select id from public.tenants where is_sample loop
    perform private.rebuild_counters(t.id);
  end loop;
  perform private.seed_sample_orders();
  perform private.log('reset_demo', 'settings', null, '{}'::jsonb);
end;
$$;

-- Admin bisa menghapus semua data contoh sekaligus saat tidak dibutuhkan lagi. Setoran ikut terhapus bersama tenant.
create or replace function public.admin_delete_sample_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform private.purge_sample_tenant_orders();
  perform private.purge_sample_tenants();
  perform private.log('hapus_data_contoh', 'settings', null, '{}'::jsonb);
end;
$$;

-- Hak jalankan fungsi API
revoke execute on function
  public.register_tenant(jsonb), public.resubmit_tenant(uuid), public.my_tenants(), public.seller_buyer_history(uuid, uuid),
  public.payout_details(uuid), public.team_review_tenant(uuid, boolean, text),
  public.team_refund(uuid, boolean, int, public.penanggung, text), public.team_cancel_order(uuid, text),
  public.team_reply_report(uuid, text, public.status_laporan), public.team_pending_payments(), public.team_dashboard(int),
  public.team_list_members(), public.team_add_member(text, public.peran_tim), public.team_update_member(uuid, public.peran_tim),
  public.admin_update_fees(int, int), public.demo_panel(), public.demo_set_mode(boolean), public.demo_reset(),
  public.admin_delete_sample_data()
  from public, anon;
grant execute on function
  public.register_tenant(jsonb), public.resubmit_tenant(uuid), public.my_tenants(), public.seller_buyer_history(uuid, uuid),
  public.payout_details(uuid), public.team_review_tenant(uuid, boolean, text),
  public.team_refund(uuid, boolean, int, public.penanggung, text), public.team_cancel_order(uuid, text),
  public.team_reply_report(uuid, text, public.status_laporan), public.team_pending_payments(), public.team_dashboard(int),
  public.team_list_members(), public.team_add_member(text, public.peran_tim), public.team_update_member(uuid, public.peran_tim),
  public.admin_update_fees(int, int), public.demo_panel(), public.demo_set_mode(boolean), public.demo_reset(),
  public.admin_delete_sample_data()
  to authenticated;
