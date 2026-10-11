-- Tenant contoh juga buka Sabtu dan Minggu, 07.00 sampai 17.00, supaya jam ambil hari ini
-- selalu bisa dicoba saat latihan demo. Tenant sungguhan tidak tersentuh.
-- Database lokal yang dibuat ulang mendapat baris yang sama dari supabase/seed.sql.
insert into public.tenant_hours (tenant_id, weekday, open_time, close_time)
select t.id, d, time '07:00', time '17:00'
from public.tenants t
cross join generate_series(6, 7) as d
where t.is_sample
  and not exists (select 1 from public.tenant_hours h where h.tenant_id = t.id and h.weekday = d);
