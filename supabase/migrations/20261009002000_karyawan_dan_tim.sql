-- P1 nomor 10 dan 11: undang karyawan (J24), rekap gabungan pengelola banyak tenant (J25), tangguhkan akun (A07, T08),
-- catatan aktivitas untuk tim (T10), dan dasbor per tenant (T12).

create or replace function private.require_owner(p_tenant uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.tenant_members where tenant_id = p_tenant and user_id = auth.uid() and role = 'pemilik') then
    raise exception 'not_tenant_owner';
  end if;
end;
$$;

-- Karyawan -----------------------------------------------------------------------------------------

create or replace function public.owner_members(p_tenant uuid)
returns table (user_id uuid, full_name text, email text, role public.peran_tenant, is_self boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_owner(p_tenant);
  return query
    select tm.user_id, p.full_name, u.email::text, tm.role, tm.user_id = auth.uid()
    from public.tenant_members tm join public.profiles p on p.id = tm.user_id join auth.users u on u.id = tm.user_id
    where tm.tenant_id = p_tenant
    order by tm.role, tm.created_at;
end;
$$;

-- Pemilik mengundang lewat email akun yang sudah terdaftar, sama seperti anggota tim. Karyawan hanya menangani pesanan.
create or replace function public.owner_add_employee(p_tenant uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_name text;
begin
  perform private.require_owner(p_tenant);
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'account_not_found';
  end if;
  if exists (select 1 from public.tenant_members where tenant_id = p_tenant and user_id = v_user) then
    raise exception 'already_member';
  end if;
  insert into public.tenant_members (tenant_id, user_id, role) values (p_tenant, v_user, 'karyawan');
  select name into v_name from public.tenants where id = p_tenant;
  perform private.log('tambah_karyawan', 'tenant', p_tenant, jsonb_build_object('user_id', v_user));
  perform private.notify(v_user, 'jadi_karyawan', jsonb_build_object('tenant_name', v_name), '/penjual');
end;
$$;

create or replace function public.owner_remove_employee(p_tenant uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_owner(p_tenant);
  if exists (select 1 from public.tenant_members where tenant_id = p_tenant and user_id = p_user and role = 'pemilik') then
    raise exception 'cannot_remove_owner';
  end if;
  delete from public.tenant_members where tenant_id = p_tenant and user_id = p_user and role = 'karyawan';
  perform private.log('hapus_karyawan', 'tenant', p_tenant, jsonb_build_object('user_id', p_user));
end;
$$;

-- Rekap gabungan untuk pengelola banyak tenant: semua tenant tempat pengguna menjadi anggota.
create or replace function public.seller_combined_summary(p_days int default 7)
returns table (tenant_id uuid, tenant_name text, orders int, cancelled int, sales int, seller_share int)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name,
    count(o.id) filter (where o.status not in ('dibatalkan'))::int,
    count(o.id) filter (where o.status = 'dibatalkan')::int,
    coalesce(sum(o.subtotal - o.promo_discount) filter (where o.status not in ('dibatalkan')), 0)::int,
    coalesce(sum(o.subtotal - o.promo_discount - o.seller_fee - o.refunded_total) filter (where o.status not in ('dibatalkan')), 0)::int
  from public.tenant_members tm
  join public.tenants t on t.id = tm.tenant_id
  left join public.orders o on o.tenant_id = t.id and o.paid_at is not null
    and o.pickup_date > private.today_wib() - least(greatest(p_days, 1), 90) and o.pickup_date <= private.today_wib()
  where tm.user_id = auth.uid()
  group by t.id, t.name
  order by t.name
$$;

-- Tangguhkan akun ----------------------------------------------------------------------------------

alter table public.profiles add column suspend_reason text check (length(suspend_reason) <= 200);

-- Akun yang ditangguhkan tidak bisa memesan (create_order dan join_waitlist memeriksa is_suspended).
create or replace function public.admin_set_account_suspension(p_email text, p_suspend boolean, p_reason text)
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
  if v_user = auth.uid() then
    raise exception 'cannot_suspend_self';
  end if;
  if p_suspend and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'reason_required';
  end if;
  update public.profiles
    set is_suspended = p_suspend, suspend_reason = case when p_suspend then left(trim(p_reason), 200) end
    where id = v_user;
  perform private.log(case when p_suspend then 'tangguhkan_akun' else 'aktifkan_akun' end, 'profile', v_user,
    jsonb_build_object('reason', case when p_suspend then trim(p_reason) end));
end;
$$;

create or replace function public.team_suspended_accounts()
returns table (user_id uuid, full_name text, email text, suspend_reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_team();
  return query
    select p.id, p.full_name, u.email::text, p.suspend_reason
    from public.profiles p join auth.users u on u.id = p.id
    where p.is_suspended
    order by p.full_name;
end;
$$;

-- Catatan aktivitas -------------------------------------------------------------------------------

create or replace function public.team_activity(p_limit int default 50)
returns table (id bigint, created_at timestamptz, actor_name text, action text, target_type text, target_name text, details jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_team();
  return query
    select a.id, a.created_at, coalesce(p.full_name, '-'), a.action, a.target_type,
      coalesce(t.name, tp.full_name, case when o.id is not null then '#' || lpad(o.order_number::text, 3, '0') end),
      a.details
    from public.audit_log a
    left join public.profiles p on p.id = a.actor_id
    left join public.tenants t on a.target_type = 'tenant' and t.id = a.target_id
    left join public.profiles tp on a.target_type = 'profile' and tp.id = a.target_id
    left join public.orders o on a.target_type = 'order' and o.id = a.target_id
    order by a.created_at desc, a.id desc
    limit least(greatest(p_limit, 1), 200);
end;
$$;

-- Dasbor per tenant -------------------------------------------------------------------------------

create or replace function public.team_tenant_dashboard(p_days int default 7)
returns table (tenant_id uuid, tenant_name text, status public.status_tenant, is_sample boolean, orders int, cancelled int,
  not_picked_up int, gross int, jaminin_revenue int, last_payout_date date, last_payout_amount int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_team();
  return query
    select t.id, t.name, t.status, t.is_sample,
      count(o.id) filter (where o.status in ('diterima', 'disiapkan', 'siap', 'selesai', 'tidak_diambil'))::int,
      count(o.id) filter (where o.status = 'dibatalkan')::int,
      count(o.id) filter (where o.status = 'tidak_diambil')::int,
      coalesce(sum(o.subtotal - o.promo_discount) filter (where o.status in ('selesai', 'tidak_diambil')), 0)::int,
      coalesce(sum(o.service_fee + o.seller_fee) filter (where o.status in ('selesai', 'tidak_diambil')), 0)::int,
      (select max(py.payout_date) from public.payouts py where py.tenant_id = t.id),
      (select py.amount from public.payouts py where py.tenant_id = t.id order by py.payout_date desc, py.sent_at desc limit 1)
    from public.tenants t
    left join public.orders o on o.tenant_id = t.id and o.paid_at is not null
      and o.pickup_date > private.today_wib() - least(greatest(p_days, 1), 90) and o.pickup_date <= private.today_wib()
    where t.status in ('disetujui', 'ditangguhkan')
    group by t.id, t.name, t.status, t.is_sample
    order by t.name;
end;
$$;

-- Hak eksekusi: fungsi private tertutup secara bawaan; fungsi public hanya untuk pengguna yang masuk.
revoke execute on function public.owner_members(uuid), public.owner_add_employee(uuid, text), public.owner_remove_employee(uuid, uuid),
  public.seller_combined_summary(int), public.admin_set_account_suspension(text, boolean, text), public.team_suspended_accounts(),
  public.team_activity(int), public.team_tenant_dashboard(int) from public, anon;
grant execute on function public.owner_members(uuid), public.owner_add_employee(uuid, text), public.owner_remove_employee(uuid, uuid),
  public.seller_combined_summary(int), public.admin_set_account_suspension(text, boolean, text), public.team_suspended_accounts(),
  public.team_activity(int), public.team_tenant_dashboard(int) to authenticated;
