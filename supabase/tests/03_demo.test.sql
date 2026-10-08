begin;
select plan(13);

update public.app_settings set demo_mode = true where id = 1;

create temporary table t_demo as
select
  (select id from auth.users where email = 'demo+pembeli@jaminin.test') as demo_buyer,
  (select id from auth.users where email = 'demo+admin@jaminin.test') as demo_admin,
  (select id from auth.users where email = 'demo+staf@jaminin.test') as demo_staff,
  tests.create_user('asli@uji.test') as real_buyer,
  (select id from public.tenants where slug = 'mama-bento') as tenant,
  (select id from public.menu_items where name = 'Rice Bowl') as rice_bowl,
  (private.today_wib() + 1) as tomorrow;
grant select on t_demo to authenticated, anon;

-- 1-2. Akun demo dan akun asli sama-sama memesan di tenant contoh, besok jam 12.00.
select tests.as_user((select demo_buyer from t_demo));
select lives_ok(
  $$select * from public.create_order((select tenant from t_demo), (select tomorrow from t_demo), '12:00',
    jsonb_build_array(jsonb_build_object('menu_item_id', (select rice_bowl from t_demo), 'quantity', 1)), 'Demo', 'bungkus', false, null)$$,
  'akun demo bisa memesan'
);
select tests.as_user((select real_buyer from t_demo));
select lives_ok(
  $$select * from public.create_order((select tenant from t_demo), (select tomorrow from t_demo), '12:00',
    jsonb_build_array(jsonb_build_object('menu_item_id', (select rice_bowl from t_demo), 'quantity', 1)), 'Asli', 'bungkus', false, null)$$,
  'akun asli bisa memesan'
);

-- 3. Dua pesanan menahan dua kuota di jam itu.
select tests.as_postgres();
select is(
  (select used from public.slot_usage where tenant_id = (select tenant from t_demo) and pickup_date = (select tomorrow from t_demo) and pickup_time = '12:00'),
  2, 'dua pesanan menahan kuota'
);

-- 4. Pengguna biasa tidak bisa me-reset demo.
select tests.as_user((select real_buyer from t_demo));
select throws_ok($$select public.demo_reset()$$, 'P0001', 'not_team', 'pengguna biasa tidak bisa reset demo');

-- 5-9. Staf tim me-reset: pesanan akun demo hilang, pesanan akun asli tetap, kuota dihitung ulang, pesanan contoh dibuat lagi.
select tests.as_user((select demo_staff from t_demo));
select lives_ok($$select public.demo_reset()$$, 'anggota tim bisa reset demo');
select tests.as_postgres();
select is(
  (select count(*)::int from public.orders where buyer_id = (select demo_buyer from t_demo) and not is_sample),
  0, 'pesanan akun demo terhapus'
);
select is((select count(*)::int from public.orders where buyer_id = (select real_buyer from t_demo)), 1, 'pesanan akun asli tetap');
select is(
  (select used from public.slot_usage where tenant_id = (select tenant from t_demo) and pickup_date = (select tomorrow from t_demo) and pickup_time = '12:00'),
  1, 'kuota dihitung ulang dari pesanan yang tersisa'
);
select ok((select count(*) from public.orders where is_sample) > 0, 'pesanan contoh dibuat ulang');

-- 10-13. Hapus data contoh hanya untuk admin; tenant contoh dan setorannya hilang, tenant asli tidak tersentuh.
insert into public.tenants (slug, name, kiosk_location, whatsapp, contact_person, type, base_quota, status)
values ('tenant-asli-uji', 'Tenant Asli Uji', 'Kios 1', '+6281234567890', 'Pemilik Asli', 'makanan', 2, 'disetujui');
select tests.as_user((select demo_staff from t_demo));
select throws_ok($$select public.admin_delete_sample_data()$$, 'P0001', 'not_admin', 'staf tidak bisa menghapus data contoh');
select tests.as_user((select demo_admin from t_demo));
select lives_ok($$select public.admin_delete_sample_data()$$, 'admin bisa menghapus data contoh');
select tests.as_postgres();
select is((select count(*)::int from public.tenants where is_sample), 0, 'tenant contoh terhapus beserta setorannya');
select is((select count(*)::int from public.tenants where slug = 'tenant-asli-uji'), 1, 'tenant asli tetap ada');

select * from finish();
rollback;
