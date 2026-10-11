-- Saat mode demo, tenant contoh buka sepanjang hari (00.00 sampai 23.59) supaya latihan demo tidak
-- terhalang jam buka. Penutupnya 23.59.59, bukan 24.00, karena perulangan jam ambil di private.slots
-- memakai tipe time yang berputar ke 00.00 setelah 23.55. Jam ambil terakhir menjadi 23.50.
-- Selebihnya sama dengan versi di 20261008001300: jam khusus dan libur tetap berlaku lebih dulu.
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

  select t.is_sample into v_sample from public.tenants t where t.id = p_tenant;
  select s.demo_mode into v_demo from public.app_settings s where s.id = 1;
  if v_sample and v_demo then
    return query select time '00:00', time '23:59:59';
    return;
  end if;

  return query
    select h.open_time, h.close_time from public.tenant_hours h
    where h.tenant_id = p_tenant and h.weekday = extract(isodow from p_date)::smallint
    order by h.open_time;
end;
$$;
