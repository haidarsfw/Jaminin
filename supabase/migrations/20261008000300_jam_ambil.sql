-- Jam ambil: jam buka, kuota, rumus jam tercepat, dan daftar jam 5 menit.
-- Rumus: jam tercepat = sekarang + batas bayar + batas waktu pesan + lama menyiapkan terlama, dibulatkan ke 5 menit berikutnya.

-- Rentang jam buka tenant pada satu tanggal. Saat mode demo menyala, tenant contoh buka 06.00 sampai 22.00 setiap hari.
create or replace function private.tenant_ranges(p_tenant uuid, p_date date)
returns table (open_time time, close_time time)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sample boolean;
  v_demo boolean;
begin
  select t.is_sample into v_sample from public.tenants t where t.id = p_tenant;
  select s.demo_mode into v_demo from public.app_settings s where s.id = 1;

  if v_sample and v_demo then
    return query select time '06:00', time '22:00';
    return;
  end if;

  if exists (select 1 from public.tenant_special_hours sh where sh.tenant_id = p_tenant and sh.date = p_date) then
    if exists (select 1 from public.tenant_special_hours sh where sh.tenant_id = p_tenant and sh.date = p_date and sh.is_closed) then
      return;
    end if;
    return query
      select sh.open_time, sh.close_time from public.tenant_special_hours sh
      where sh.tenant_id = p_tenant and sh.date = p_date
      order by sh.open_time;
    return;
  end if;

  return query
    select h.open_time, h.close_time from public.tenant_hours h
    where h.tenant_id = p_tenant and h.weekday = extract(isodow from p_date)::smallint
    order by h.open_time;
end;
$$;

-- Jam tutup terakhir pada satu tanggal (null kalau tidak buka).
create or replace function private.tenant_last_close(p_tenant uuid, p_date date)
returns time
language sql
stable
security definer
set search_path = ''
as $$ select max(r.close_time) from private.tenant_ranges(p_tenant, p_date) r $$;

create or replace function private.slot_quota(p_tenant uuid, p_time time)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select min(q.quota) from public.tenant_quota_rules q
      where q.tenant_id = p_tenant and q.start_time <= p_time and p_time < q.end_time),
    (select t.base_quota from public.tenants t where t.id = p_tenant)
  )
$$;

create or replace function private.is_paused(p_tenant uuid, p_now timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select t.paused_indefinitely or (t.paused_until is not null and t.paused_until > p_now)
    from public.tenants t where t.id = p_tenant), false)
$$;

-- Jam ambil paling cepat (waktu WIB tanpa zona).
create or replace function private.earliest_pickup(p_tenant uuid, p_max_prep int, p_now timestamptz default now())
returns timestamp
language sql
stable
security definer
set search_path = ''
as $$
  select private.ceil_5min(
    private.now_wib(p_now)
    + make_interval(mins => (select s.payment_window_minutes from public.app_settings s where s.id = 1))
    + make_interval(mins => (select t.order_cutoff_minutes from public.tenants t where t.id = p_tenant))
    + make_interval(mins => greatest(coalesce(p_max_prep, 0), 0))
  )
$$;

-- Daftar jam ambil satu tanggal beserta statusnya.
-- status: tersedia, penuh, lewat (lebih awal dari jam tercepat), jeda (penjual menutup sementara), batas_harian.
create or replace function private.slots(p_tenant uuid, p_date date, p_max_prep int, p_now timestamptz default now())
returns table (slot_time time, status text, remaining int, quota int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_earliest timestamp;
  v_paused boolean;
  v_limit int;
  v_count int;
  v_today date := private.today_wib(p_now);
  r record;
  v_t time;
  v_q int;
  v_used int;
begin
  if p_date < v_today or p_date > v_today + 1 then
    return;
  end if;
  if not exists (select 1 from public.tenants t where t.id = p_tenant and t.status = 'disetujui') then
    return;
  end if;

  v_earliest := private.earliest_pickup(p_tenant, p_max_prep, p_now);
  v_paused := private.is_paused(p_tenant, p_now);
  select t.daily_order_limit into v_limit from public.tenants t where t.id = p_tenant;
  select coalesce(dc.orders_count, 0) into v_count from public.daily_counters dc
    where dc.tenant_id = p_tenant and dc.pickup_date = p_date;
  v_count := coalesce(v_count, 0);

  for r in select * from private.tenant_ranges(p_tenant, p_date) loop
    v_t := (private.ceil_5min(p_date + r.open_time))::time;
    -- Jam ambil terakhir 5 menit sebelum tutup.
    while v_t <= r.close_time - interval '5 minutes' and v_t >= r.open_time loop
      v_q := private.slot_quota(p_tenant, v_t);
      select coalesce(su.used, 0) into v_used from public.slot_usage su
        where su.tenant_id = p_tenant and su.pickup_date = p_date and su.pickup_time = v_t;
      v_used := coalesce(v_used, 0);

      slot_time := v_t;
      quota := v_q;
      remaining := greatest(v_q - v_used, 0);
      if (p_date + v_t) < v_earliest then
        status := 'lewat';
      elsif v_paused then
        status := 'jeda';
      elsif v_limit is not null and v_count >= v_limit then
        status := 'batas_harian';
      elsif v_used >= v_q then
        status := 'penuh';
      else
        status := 'tersedia';
      end if;
      return next;

      exit when v_t >= time '23:55';
      v_t := v_t + interval '5 minutes';
    end loop;
  end loop;
end;
$$;

-- Lama menyiapkan menu tercepat yang masih bisa dipesan pada tanggal itu (dipakai beranda, usulan U5).
create or replace function private.fastest_prep(p_tenant uuid, p_date date)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select min(mi.prep_minutes) from public.menu_items mi
  where mi.tenant_id = p_tenant and mi.is_active
    and not mi.sold_out_indefinite
    and (mi.sold_out_date is distinct from p_date)
    and (mi.daily_stock is null or mi.daily_stock > coalesce(
      (select su.used from public.stock_usage su where su.menu_item_id = mi.id and su.pickup_date = p_date), 0))
$$;

-- API: daftar jam untuk checkout (lama menyiapkan terlama di keranjang dikirim dari klien, dihitung ulang saat pesan).
create or replace function public.get_slots(p_tenant uuid, p_date date, p_max_prep int)
returns table (slot_time time, status text, remaining int, quota int, promo_id uuid, promo_kind public.jenis_promo, promo_value int)
language sql
stable
security definer
set search_path = ''
as $$
  select s.slot_time, s.status, s.remaining, s.quota, p.id, p.kind, p.value
  from private.slots(p_tenant, p_date, p_max_prep) s
  left join lateral (
    select pr.id, pr.kind, pr.value from public.promos pr
    where pr.tenant_id = p_tenant and pr.is_active
      and extract(isodow from p_date)::smallint = any (pr.weekdays)
      and pr.start_time <= s.slot_time and s.slot_time < pr.end_time
    order by pr.value desc
    limit 1
  ) p on true
  order by s.slot_time
$$;

-- API: daftar tenant di beranda dengan jam tercepat hari ini atau besok.
create or replace function public.home_tenants()
returns table (
  id uuid, slug text, name text, description text, kiosk_location text, logo_path text, is_sample boolean,
  announcement text, open_now boolean, paused boolean, today_ranges jsonb,
  earliest_date date, earliest_time time, fastest_prep int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t record;
  v_today date := private.today_wib();
  v_now_t time := private.now_wib()::time;
  v_prep int;
  s record;
begin
  for t in select * from public.tenants where status = 'disetujui' order by name loop
    id := t.id; slug := t.slug; name := t.name; description := t.description; kiosk_location := t.kiosk_location;
    logo_path := t.logo_path; is_sample := t.is_sample; announcement := t.announcement;
    paused := private.is_paused(t.id);
    select coalesce(jsonb_agg(jsonb_build_object('open', r.open_time, 'close', r.close_time) order by r.open_time), '[]'::jsonb)
      into today_ranges from private.tenant_ranges(t.id, v_today) r;
    open_now := exists (select 1 from private.tenant_ranges(t.id, v_today) r where r.open_time <= v_now_t and v_now_t < r.close_time);
    earliest_date := null; earliest_time := null; fastest_prep := null;

    for d in 0 .. 1 loop
      v_prep := private.fastest_prep(t.id, v_today + d);
      continue when v_prep is null;
      select sl.slot_time into s from private.slots(t.id, v_today + d, v_prep) sl
        where sl.status = 'tersedia' order by sl.slot_time limit 1;
      if found then
        earliest_date := v_today + d;
        earliest_time := s.slot_time;
        fastest_prep := v_prep;
        exit;
      end if;
    end loop;
    return next;
  end loop;
end;
$$;

-- API: status satu jam ambil di semua tenant (tombol jam istirahat, usulan U7).
create or replace function public.slot_status_all(p_date date, p_time time)
returns table (tenant_id uuid, status text, remaining int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t record;
  v_prep int;
begin
  for t in select id from public.tenants where status = 'disetujui' loop
    tenant_id := t.id;
    v_prep := private.fastest_prep(t.id, p_date);
    if v_prep is null then
      status := 'tutup'; remaining := 0;
      return next;
      continue;
    end if;
    select sl.status, sl.remaining into status, remaining
      from private.slots(t.id, p_date, v_prep) sl where sl.slot_time = p_time;
    if not found then
      status := 'tutup'; remaining := 0;
    end if;
    return next;
  end loop;
end;
$$;

grant execute on function public.get_slots(uuid, date, int), public.home_tenants(), public.slot_status_all(date, time)
  to anon, authenticated;
