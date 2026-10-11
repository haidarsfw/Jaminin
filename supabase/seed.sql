-- Data awal untuk database lokal (supabase db reset). Proyek online diisi dengan perintah yang sama lewat konektor.
insert into private.config (key, value) values ('functions_url', 'http://kong:8000/functions/v1')
on conflict (key) do update set value = excluded.value;

select private.seed_demo('demo+{peran}@jaminin.test');

-- Sama dengan migrasi 20261011000100: tenant contoh juga buka Sabtu dan Minggu, 07.00 sampai 17.00.
insert into public.tenant_hours (tenant_id, weekday, open_time, close_time)
select t.id, d, time '07:00', time '17:00'
from public.tenants t
cross join generate_series(6, 7) as d
where t.is_sample
  and not exists (select 1 from public.tenant_hours h where h.tenant_id = t.id and h.weekday = d);

-- Sama dengan migrasi 20261011000200: lokasi kios tenant contoh tanpa teks "belum diisi".
update public.tenants t
set kiosk_location = 'Kantin BINUS @Bekasi, kios ' || n.nomor
from (select id, row_number() over (order by name) as nomor from public.tenants where is_sample) n
where t.id = n.id and t.kiosk_location like '%belum diisi%';

-- Akun cepat khusus database lokal: ketik "admin" dan sandi "admin" di halaman Masuk.
-- Satu akun dengan semua akses: pembeli, pemilik semua tenant contoh, dan admin tim.
-- Jangan pernah dibuat di Supabase online, karena sandinya lemah.
do $$
declare
  v_id uuid := private.create_demo_user('admin@jaminin.test', 'Admin Jaminin', 'semua', 0, '+620000000009', 'mahasiswa');
  r record;
begin
  update auth.users set encrypted_password = extensions.crypt('admin', extensions.gen_salt('bf')) where id = v_id;
  insert into public.team_members (user_id, role) values (v_id, 'admin') on conflict (user_id) do nothing;
  for r in select id from public.tenants where is_sample loop
    insert into public.tenant_members (tenant_id, user_id, role) values (r.id, v_id, 'pemilik') on conflict do nothing;
  end loop;
end $$;

-- Mode demo tetap menyala (diatur seed_demo), jadi tenant contoh buka sepanjang hari saat latihan dan presentasi.
