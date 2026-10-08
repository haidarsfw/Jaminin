begin;
select plan(14);

-- Pembulatan ke kelipatan 5 menit berikutnya.
select is(private.ceil_5min('2026-10-12 11:09:00'), '2026-10-12 11:10:00'::timestamp, '11.09 dibulatkan menjadi 11.10');
select is(private.ceil_5min('2026-10-12 11:10:00'), '2026-10-12 11:10:00'::timestamp, '11.10 tetap 11.10');
select is(private.ceil_5min('2026-10-12 11:09:30'), '2026-10-12 11:10:00'::timestamp, 'detik ikut dibulatkan ke atas');
select is(private.ceil_5min('2026-10-12 11:55:01'), '2026-10-12 12:00:00'::timestamp, 'lewat jam berganti ke jam berikutnya');

-- Contoh di PRD: 10.47 + 5 batas bayar + 5 batas waktu pesan + 12 katsu = 11.09, menjadi 11.10.
update public.app_settings set demo_mode = false where id = 1;
select is(
  private.earliest_pickup((select id from public.tenants where slug = 'rustic-grill-bbq'), 12, '2026-10-12 10:47:00+07'),
  '2026-10-12 11:10:00'::timestamp,
  'rumus jam tercepat sesuai contoh PRD'
);

-- Senin 12 Oktober 2026 pukul 10.47: 11.05 terlalu cepat, 11.10 tersedia, jam ambil terakhir 16.55.
select is(
  (select status from private.slots((select id from public.tenants where slug = 'rustic-grill-bbq'), '2026-10-12', 12, '2026-10-12 10:47:00+07') where slot_time = '11:05'),
  'lewat', '11.05 lebih awal dari jam tercepat'
);
select is(
  (select status from private.slots((select id from public.tenants where slug = 'rustic-grill-bbq'), '2026-10-12', 12, '2026-10-12 10:47:00+07') where slot_time = '11:10'),
  'tersedia', '11.10 tersedia'
);
select is(
  (select max(slot_time) from private.slots((select id from public.tenants where slug = 'rustic-grill-bbq'), '2026-10-12', 12, '2026-10-12 10:47:00+07')),
  '16:55'::time, 'jam ambil terakhir 5 menit sebelum tutup'
);
select is(
  (select count(*)::int from private.slots((select id from public.tenants where slug = 'rustic-grill-bbq'), '2026-10-12', 12, '2026-10-12 10:47:00+07')),
  120, 'jam 07.00 sampai 16.55 tiap 5 menit'
);

-- Hanya hari ini atau besok.
select is(
  (select count(*)::int from private.slots((select id from public.tenants where slug = 'rustic-grill-bbq'), '2026-10-14', 12, '2026-10-12 10:47:00+07')),
  0, 'lusa tidak ditawarkan'
);

-- Sabtu tutup untuk tenant contoh saat mode demo mati.
select is(
  (select count(*)::int from private.slots((select id from public.tenants where slug = 'rustic-grill-bbq'), '2026-10-10', 0, '2026-10-10 08:00:00+07')),
  0, 'Sabtu tutup'
);

-- Mode demo: tenant contoh buka 06.00 sampai 22.00 setiap hari.
update public.app_settings set demo_mode = true where id = 1;
select is(
  (select max(slot_time) from private.slots((select id from public.tenants where slug = 'rustic-grill-bbq'), '2026-10-10', 0, '2026-10-10 05:00:00+07')),
  '21:55'::time, 'mode demo membuka tenant contoh sampai 22.00'
);

-- Kuota per rentang jam memakai aturan, jam lain memakai kuota dasar.
insert into public.tenant_quota_rules (tenant_id, start_time, end_time, quota)
  values ((select id from public.tenants where slug = 'rustic-grill-bbq'), '11:00', '13:00', 1);
select is(private.slot_quota((select id from public.tenants where slug = 'rustic-grill-bbq'), '11:30'), 1, 'kuota rentang 11.00 sampai 13.00');
select is(private.slot_quota((select id from public.tenants where slug = 'rustic-grill-bbq'), '14:00'), 3, 'kuota dasar di luar rentang');

select * from finish();
rollback;
