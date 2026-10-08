-- Profil, pendaftaran penjual, tindakan tim, setoran, dan mode demo.

-- Profil dianggap lengkap kalau nama, WhatsApp, dan status terisi.
create or replace function private.profile_complete_check()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if length(trim(new.full_name)) > 0 and new.whatsapp is not null and new.status is not null then
    new.profile_completed_at := coalesce(new.profile_completed_at, now());
  end if;
  return new;
end;
$$;

create trigger profiles_complete before insert or update on public.profiles
  for each row execute function private.profile_complete_check();

-- Rentang jam buka dalam satu hari tidak boleh tumpang tindih.
create or replace function private.check_hours_overlap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.tenant_hours h
    where h.tenant_id = new.tenant_id and h.weekday = new.weekday and h.id <> new.id
      and h.open_time < new.close_time and new.open_time < h.close_time
  ) then
    raise exception 'hours_overlap';
  end if;
  return new;
end;
$$;

create trigger tenant_hours_overlap before insert or update on public.tenant_hours
  for each row execute function private.check_hours_overlap();

create or replace function private.require_team()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_team() then
    raise exception 'not_team';
  end if;
end;
$$;

create or replace function private.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_admin';
  end if;
end;
$$;

create or replace function private.slugify(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(p_text), '[^a-z0-9]+', '-', 'g')), ''), 'tenant')
$$;

-- Menyimpan menu (kategori, menu, pilihan) dari JSON. Dipakai saat mendaftar.
create or replace function private.insert_menu(p_tenant uuid, p_categories jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  c jsonb;
  i jsonb;
  g jsonb;
  o jsonb;
  v_cat uuid;
  v_item uuid;
  v_group uuid;
  v_count int := 0;
  v_ci int := 0;
  v_ii int;
  v_gi int;
  v_oi int;
begin
  for c in select * from jsonb_array_elements(coalesce(p_categories, '[]'::jsonb)) loop
    v_ci := v_ci + 1;
    insert into public.menu_categories (tenant_id, name, sort_order) values (p_tenant, c ->> 'name', v_ci) returning id into v_cat;
    v_ii := 0;
    for i in select * from jsonb_array_elements(coalesce(c -> 'items', '[]'::jsonb)) loop
      v_ii := v_ii + 1;
      insert into public.menu_items (tenant_id, category_id, name, description, price, prep_minutes, tags, sort_order)
      values (
        p_tenant, v_cat, i ->> 'name', nullif(i ->> 'description', ''), (i ->> 'price')::int, (i ->> 'prep_minutes')::int,
        coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(i -> 'tags', '[]'::jsonb)) x), '{}'), v_ii
      ) returning id into v_item;
      v_count := v_count + 1;
      v_gi := 0;
      for g in select * from jsonb_array_elements(coalesce(i -> 'option_groups', '[]'::jsonb)) loop
        v_gi := v_gi + 1;
        insert into public.option_groups (item_id, name, min_select, max_select, sort_order)
        values (v_item, g ->> 'name', coalesce((g ->> 'min_select')::int, 0), coalesce((g ->> 'max_select')::int, 1), v_gi)
        returning id into v_group;
        v_oi := 0;
        for o in select * from jsonb_array_elements(coalesce(g -> 'options', '[]'::jsonb)) loop
          v_oi := v_oi + 1;
          insert into public.options (group_id, name, price_delta, sort_order)
          values (v_group, o ->> 'name', coalesce((o ->> 'price_delta')::int, 0), v_oi);
        end loop;
      end loop;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- Pendaftaran penjual lengkap dalam satu kali kirim. Status awal: menunggu persetujuan tim.
create or replace function public.register_tenant(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_slug text;
  v_base text;
  v_n int := 1;
  h jsonb;
  q jsonb;
  v_items int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and profile_completed_at is not null) then
    raise exception 'profile_incomplete';
  end if;
  if coalesce((p ->> 'terms_accepted')::boolean, false) is not true then
    raise exception 'terms_required';
  end if;
  if jsonb_array_length(coalesce(p -> 'hours', '[]'::jsonb)) = 0 then
    raise exception 'hours_required';
  end if;

  v_base := private.slugify(p ->> 'name');
  v_slug := v_base;
  while exists (select 1 from public.tenants where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.tenants (
    slug, name, description, kiosk_location, whatsapp, contact_person, type, managed_by, manager_name,
    order_cutoff_minutes, base_quota, payout_time, status, terms_accepted_at, created_by, submitted_at
  ) values (
    v_slug, trim(p ->> 'name'), nullif(trim(coalesce(p ->> 'description', '')), ''), trim(p ->> 'kiosk_location'),
    p ->> 'whatsapp', trim(p ->> 'contact_person'), (p ->> 'type')::public.jenis_tenant,
    coalesce((p ->> 'managed_by')::public.pengelola_tenant, 'mandiri'), nullif(trim(coalesce(p ->> 'manager_name', '')), ''),
    coalesce((p ->> 'order_cutoff_minutes')::int, 5), (p ->> 'base_quota')::int, nullif(p ->> 'payout_time', '')::time,
    'menunggu', now(), v_uid, now()
  ) returning id into v_id;

  insert into public.tenant_members (tenant_id, user_id, role) values (v_id, v_uid, 'pemilik');

  insert into public.tenant_bank (tenant_id, bank_name, account_number, account_holder)
  values (v_id, trim(p -> 'bank' ->> 'bank_name'), trim(p -> 'bank' ->> 'account_number'), trim(p -> 'bank' ->> 'account_holder'));

  for h in select * from jsonb_array_elements(p -> 'hours') loop
    insert into public.tenant_hours (tenant_id, weekday, open_time, close_time)
    values (v_id, (h ->> 'weekday')::smallint, (h ->> 'open')::time, (h ->> 'close')::time);
  end loop;

  for q in select * from jsonb_array_elements(coalesce(p -> 'quota_rules', '[]'::jsonb)) loop
    insert into public.tenant_quota_rules (tenant_id, start_time, end_time, quota)
    values (v_id, (q ->> 'start')::time, (q ->> 'end')::time, (q ->> 'quota')::int);
  end loop;

  v_items := private.insert_menu(v_id, p -> 'categories');
  if v_items = 0 then
    raise exception 'menu_required';
  end if;

  perform private.notify_team('pendaftaran_baru', jsonb_build_object('tenant_id', v_id, 'tenant_name', trim(p ->> 'name')), '/tim/penjual');
  return v_id;
end;
$$;

-- Penjual yang ditolak memperbaiki data lalu mengirim ulang (usulan U9).
create or replace function public.resubmit_tenant(p_tenant uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if not private.is_tenant_owner(p_tenant) then
    raise exception 'not_tenant_owner';
  end if;
  update public.tenants set status = 'menunggu', reject_reason = null, submitted_at = now()
    where id = p_tenant and status = 'ditolak'
    returning name into v_name;
  if v_name is null then
    raise exception 'not_rejected';
  end if;
  perform private.notify_team('pendaftaran_baru', jsonb_build_object('tenant_id', p_tenant, 'tenant_name', v_name, 'resubmitted', true), '/tim/penjual');
end;
$$;

create or replace function public.my_tenants()
returns table (id uuid, slug text, name text, status public.status_tenant, role public.peran_tenant, reject_reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.slug, t.name, t.status, tm.role, t.reject_reason
  from public.tenant_members tm join public.tenants t on t.id = tm.tenant_id
  where tm.user_id = auth.uid()
  order by t.name
$$;

-- Riwayat batal dan tidak diambil seorang pembeli, hanya di tenant itu sendiri.
create or replace function public.seller_buyer_history(p_tenant uuid, p_buyer uuid)
returns table (cancelled int, not_picked_up int, completed int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_member(p_tenant);
  return query
    select
      count(*) filter (where status = 'dibatalkan' and end_reason in ('pembeli', 'belum_siap_jam_ambil', 'pembeli_menu_habis'))::int,
      count(*) filter (where status = 'tidak_diambil')::int,
      count(*) filter (where status = 'selesai')::int
    from public.orders where tenant_id = p_tenant and buyer_id = p_buyer;
end;
$$;

-- Rincian setoran untuk penjual: per pesanan dan potongan uang kembali, tanpa isi laporan.
create or replace function public.payout_details(p_payout uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.payouts;
begin
  select * into v from public.payouts where id = p_payout;
  if v.id is null or not (private.is_tenant_member(v.tenant_id) or private.is_team()) then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_id', o.id, 'number', o.order_number, 'pickup_date', o.pickup_date, 'status', o.status,
        'subtotal', o.subtotal, 'promo', o.promo_discount, 'seller_fee', o.seller_fee,
        'share', o.subtotal - o.promo_discount - o.seller_fee
      ) order by o.pickup_date, o.order_number)
      from public.orders o where o.payout_id = v.id
    ), '[]'::jsonb),
    'refunds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_id', o.id, 'number', o.order_number, 'pickup_date', o.pickup_date,
        'amount', r.tenant_charge, 'manual', r.is_manual
      ) order by r.created_at)
      from public.refunds r join public.orders o on o.id = r.order_id where r.charged_payout_id = v.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Tim: persetujuan penjual ------------------------------------------------------------------------

create or replace function public.team_review_tenant(p_tenant uuid, p_approve boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  perform private.require_team();
  if not p_approve and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'reason_required';
  end if;
  update public.tenants set
    status = case when p_approve then 'disetujui'::public.status_tenant else 'ditolak'::public.status_tenant end,
    reject_reason = case when p_approve then null else trim(p_reason) end,
    reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_tenant and status = 'menunggu'
  returning name into v_name;
  if v_name is null then
    raise exception 'not_pending';
  end if;
  perform private.notify_tenant(p_tenant, case when p_approve then 'pendaftaran_disetujui' else 'pendaftaran_ditolak' end,
    jsonb_build_object('tenant_name', v_name, 'reason', p_reason), '/penjual');
  perform private.log(case when p_approve then 'setujui_penjual' else 'tolak_penjual' end, 'tenant', p_tenant,
    jsonb_build_object('reason', p_reason));
end;
$$;

-- Tim: uang kembali manual dan batal ---------------------------------------------------------------

-- Penanggung dipilih tim (awalnya tenant). Uang kembali penuh membuat Jaminin ikut mengembalikan Rp2.000 bagiannya.
create or replace function public.team_refund(p_order uuid, p_full boolean, p_amount int, p_bearer public.penanggung, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.orders;
  v_remaining int;
  v_amount int;
  v_jaminin_part int;
  v_tenant_charge int := 0;
  v_jaminin_charge int := 0;
begin
  perform private.require_team();
  if p_bearer not in ('tenant', 'jaminin') then
    raise exception 'invalid_bearer';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'reason_required';
  end if;
  select * into v from public.orders where id = p_order for update;
  if v.id is null or v.paid_at is null then
    raise exception 'order_not_found';
  end if;
  v_remaining := v.total_paid - v.refunded_total;
  if p_full then
    if v.status not in ('selesai', 'tidak_diambil') then
      raise exception 'use_cancel_for_active';
    end if;
    v_amount := v_remaining;
    v_jaminin_part := case when v.jaminin_fee_returned then 0 else v.service_fee + v.seller_fee end;
    if p_bearer = 'tenant' then
      v_jaminin_charge := least(v_jaminin_part, v_amount);
      v_tenant_charge := v_amount - v_jaminin_charge;
    else
      v_jaminin_charge := v_amount;
    end if;
    update public.orders set jaminin_fee_returned = true where id = v.id;
  else
    v_amount := p_amount;
    if v_amount is null or v_amount <= 0 or v_amount > v_remaining then
      raise exception 'invalid_amount';
    end if;
    if p_bearer = 'tenant' then
      v_tenant_charge := v_amount;
    else
      v_jaminin_charge := v_amount;
    end if;
  end if;
  if v_amount <= 0 then
    raise exception 'nothing_to_refund';
  end if;
  perform private.add_refund(v.id, v_amount, case when p_full then 'penuh' else 'sebagian' end, 'manual_tim', trim(p_reason),
    p_bearer, v_tenant_charge, v_jaminin_charge, true, true);
  perform private.log('uang_kembali_manual', 'order', v.id,
    jsonb_build_object('amount', v_amount, 'bearer', p_bearer, 'full', p_full, 'reason', trim(p_reason)));
end;
$$;

create or replace function public.team_cancel_order(p_order uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_team();
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'reason_required';
  end if;
  perform private.cancel_paid_order(p_order, 'tim', auth.uid());
  perform private.log('batalkan_pesanan', 'order', p_order, jsonb_build_object('reason', trim(p_reason)));
end;
$$;

create or replace function public.team_reply_report(p_report uuid, p_body text, p_status public.status_laporan)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reports;
begin
  perform private.require_team();
  select * into r from public.reports where id = p_report for update;
  if r.id is null then
    raise exception 'not_found';
  end if;
  if length(trim(coalesce(p_body, ''))) > 0 then
    insert into public.report_replies (report_id, author_id, body) values (r.id, auth.uid(), trim(p_body));
  end if;
  update public.reports set status = coalesce(p_status, status) where id = r.id;
  perform private.notify(r.buyer_id, 'balasan_laporan',
    private.order_params(r.order_id) || jsonb_build_object('report_id', r.id, 'status', coalesce(p_status, r.status)),
    '/pesanan/' || r.order_id);
  perform private.log('balas_laporan', 'report', r.id, jsonb_build_object('status', p_status));
end;
$$;

-- Kabar ke tim saat ada laporan baru.
create or replace function private.on_report_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_team('laporan_baru', private.order_params(new.order_id) || jsonb_build_object('report_id', new.id, 'category', new.category), '/tim/laporan');
  return null;
end;
$$;

create trigger reports_notify_team after insert on public.reports
  for each row execute function private.on_report_created();

-- Tagihan yang menunggu dibayar, untuk Simulator Bayar (hanya tim, usulan U14).
create or replace function public.team_pending_payments()
returns table (order_id uuid, payment_code text, amount int, tenant_name text, pickup_name text, pay_deadline timestamptz, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_team();
  return query
    select o.id, o.payment_code, o.total_paid, t.name, o.pickup_name, o.pay_deadline, o.created_at
    from public.orders o join public.tenants t on t.id = o.tenant_id
    where o.status = 'menunggu_bayar' and o.pay_deadline > now()
    order by o.created_at;
end;
$$;

-- Dasbor tim per hari (tanggal ambil). Data contoh dihitung terpisah supaya bisa dilabeli.
create or replace function public.team_dashboard(p_days int default 7)
returns table (day date, is_sample boolean, orders int, cancelled int, not_picked_up int, jaminin_revenue int, gross int, active_tenants int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_team();
  return query
    select o.pickup_date, o.is_sample,
      count(*) filter (where o.status in ('diterima', 'disiapkan', 'siap', 'selesai', 'tidak_diambil'))::int,
      count(*) filter (where o.status = 'dibatalkan')::int,
      count(*) filter (where o.status = 'tidak_diambil')::int,
      (coalesce(sum(o.service_fee + o.seller_fee) filter (where o.status in ('selesai', 'tidak_diambil')), 0)
        - coalesce((select sum(r.jaminin_charge) from public.refunds r join public.orders o2 on o2.id = r.order_id
            where o2.pickup_date = o.pickup_date and o2.is_sample = o.is_sample and o2.status in ('selesai', 'tidak_diambil')), 0))::int,
      coalesce(sum(o.subtotal - o.promo_discount) filter (where o.status in ('selesai', 'tidak_diambil')), 0)::int,
      count(distinct o.tenant_id) filter (where o.paid_at is not null)::int
    from public.orders o
    where o.paid_at is not null and o.pickup_date > private.today_wib() - p_days and o.pickup_date <= private.today_wib() + 1
    group by o.pickup_date, o.is_sample
    order by o.pickup_date desc, o.is_sample;
end;
$$;
