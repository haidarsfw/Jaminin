-- Lokasi kios tenant contoh dibuat lengkap supaya tidak ada teks "belum diisi" saat demo.
-- Database lokal yang dibuat ulang mendapat perubahan yang sama dari supabase/seed.sql.
update public.tenants t
set kiosk_location = 'Kantin BINUS @Bekasi, kios ' || n.nomor
from (select id, row_number() over (order by name) as nomor from public.tenants where is_sample) n
where t.id = n.id and t.kiosk_location like '%belum diisi%';
