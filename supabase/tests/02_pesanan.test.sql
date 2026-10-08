begin;
select plan(38);

update public.app_settings set demo_mode = true where id = 1;

create temporary table t_ctx as
select
  tests.create_user('pembeli-a@uji.test') as buyer_a,
  tests.create_user('pembeli-b@uji.test') as buyer_b,
  tests.create_user('belum-lengkap@uji.test', false) as incomplete,
  tests.create_user('karyawan@uji.test') as employee,
  (select id from public.tenants where slug = 'rustic-grill-bbq') as tenant,
  (select id from public.menu_items where name = 'Nasi Ayam Katsu') as katsu,
  (select id from public.menu_items where name = 'Burger') as burger,
  (select id from public.menu_items where name = 'Spaghetti') as spaghetti,
  (select id from public.menu_items where name = 'Nasi Ayam Grill') as grill,
  (select o.id from public.options o join public.option_groups g on g.id = o.group_id
     join public.menu_items mi on mi.id = g.item_id where mi.name = 'Nasi Ayam Katsu' and o.name = 'Level 1') as level1,
  (select o.id from public.options o join public.option_groups g on g.id = o.group_id
     join public.menu_items mi on mi.id = g.item_id where mi.name = 'Nasi Ayam Katsu' and o.name = 'Extra keju') as keju,
  (select o.id from public.options o join public.option_groups g on g.id = o.group_id
     join public.menu_items mi on mi.id = g.item_id where mi.name = 'Nasi Ayam Grill' and o.name = 'Level 1') as grill_level1,
  (private.today_wib() + 1) as tomorrow;
grant select on t_ctx to authenticated, anon;
insert into public.tenant_members (tenant_id, user_id, role) select tenant, employee, 'karyawan' from t_ctx;

-- Satu jam ambil besok dengan kuota 1 untuk uji rebutan kuota.
insert into public.tenant_quota_rules (tenant_id, start_time, end_time, quota)
  select tenant, '12:00', '12:05', 1 from t_ctx;

-- 1. Profil belum lengkap tidak bisa memesan.
select tests.as_user((select incomplete from t_ctx));
select throws_ok(
  $$select * from public.create_order((select tenant from t_ctx), (select tomorrow from t_ctx), '12:00',
    jsonb_build_array(jsonb_build_object('menu_item_id', (select burger from t_ctx), 'quantity', 1)), 'Uji', 'bungkus', false, null)$$,
  'P0001', 'profile_incomplete', 'profil harus lengkap'
);

-- 2. Pilihan wajib (level pedas) harus diisi.
select tests.as_user((select buyer_a from t_ctx));
select throws_ok(
  $$select * from public.create_order((select tenant from t_ctx), (select tomorrow from t_ctx), '12:00',
    jsonb_build_array(jsonb_build_object('menu_item_id', (select katsu from t_ctx), 'quantity', 1)), 'Uji', 'bungkus', false, null)$$,
  'P0001', 'invalid_option_count', 'pilihan wajib harus diisi'
);

-- 3 sampai 5. Harga dihitung server termasuk pilihan berbayar.
create temporary table t_order_a as
  select * from public.create_order((select tenant from t_ctx), (select tomorrow from t_ctx), '12:00',
    jsonb_build_array(jsonb_build_object('menu_item_id', (select katsu from t_ctx), 'quantity', 2,
      'option_ids', jsonb_build_array((select level1 from t_ctx), (select keju from t_ctx)))),
    'Andi', 'bungkus', true, 'Tanpa sambal');
grant select on t_order_a to authenticated;
select is((select total_paid from t_order_a), 2 * (25000 + 3000) + 1000, 'total = (harga + extra keju) x 2 + biaya layanan');
select is(length((select payment_code from t_order_a)), 6, 'kode bayar 6 karakter');
select ok((select payment_code from t_order_a) !~ '[01OIL]', 'kode bayar tanpa karakter mirip');

-- 6. Satu pembeli hanya boleh punya satu pesanan menunggu bayar.
select throws_ok(
  $$select * from public.create_order((select tenant from t_ctx), (select tomorrow from t_ctx), '13:00',
    jsonb_build_array(jsonb_build_object('menu_item_id', (select burger from t_ctx), 'quantity', 1)), 'Uji', 'bungkus', false, null)$$,
  'P0001', 'unpaid_order_exists', 'hanya satu pesanan menunggu bayar'
);

-- 7. Kuota terakhir sudah diambil pembeli A, pembeli B ditolak.
select tests.as_user((select buyer_b from t_ctx));
select throws_ok(
  $$select * from public.create_order((select tenant from t_ctx), (select tomorrow from t_ctx), '12:00',
    jsonb_build_array(jsonb_build_object('menu_item_id', (select burger from t_ctx), 'quantity', 1)), 'Budi', 'bungkus', false, null)$$,
  'P0001', 'slot_full', 'kuota terakhir tidak bisa direbut'
);

-- 8. Pembeli tidak bisa menandai lunas sendiri.
select throws_ok(
  $$select public.internal_confirm_payment('ABCDEF')$$,
  '42501', null, 'pembeli tidak bisa memanggil konfirmasi bayar'
);

-- 9. Pembeli B tidak bisa melihat pesanan A.
select is((select count(*)::int from public.orders where id = (select order_id from t_order_a)), 0, 'pesanan orang lain tidak terlihat');

-- 10. Penjual belum melihat pesanan yang belum dibayar.
select tests.as_user((select employee from t_ctx));
select is((select count(*)::int from public.orders where id = (select order_id from t_order_a)), 0, 'penjual tidak melihat pesanan belum dibayar');

-- 11 sampai 15. Server mengonfirmasi bayar.
select tests.as_postgres();
select is((public.internal_confirm_payment((select payment_code from t_order_a)) ->> 'ok')::boolean, true, 'konfirmasi bayar berhasil');
select is((select status::text from public.orders where id = (select order_id from t_order_a)), 'diterima', 'otomatis diterima saat lunas');
select is((select order_number from public.orders where id = (select order_id from t_order_a)), 1, 'nomor urut pertama untuk tanggal ambil itu');
select is(length((select pickup_code from public.orders where id = (select order_id from t_order_a))), 4, 'kode ambil 4 karakter');
select is((public.internal_confirm_payment((select payment_code from t_order_a)) ->> 'already_paid')::boolean, true, 'bayar dua kali tidak menggandakan');

-- 16. Penjual sekarang melihat pesanan yang sudah dibayar.
select tests.as_user((select employee from t_ctx));
select is((select count(*)::int from public.orders where id = (select order_id from t_order_a)), 1, 'penjual melihat pesanan lunas');

-- 17. Mulai siapkan hanya di hari ambil (pesanan untuk besok).
select throws_ok($$select public.seller_update_status((select order_id from t_order_a), 'disiapkan')$$,
  'P0001', 'not_pickup_day', 'pesanan besok belum bisa disiapkan hari ini');

-- 18 sampai 20. Geser jam: sekali saja, kuota jam lama dilepas.
select tests.as_user((select buyer_a from t_ctx));
select lives_ok($$select public.buyer_reschedule_order((select order_id from t_order_a), (select tomorrow from t_ctx), '14:00')$$, 'geser jam pertama berhasil');
select tests.as_postgres();
select is((select used from public.slot_usage where tenant_id = (select tenant from t_ctx) and pickup_date = (select tomorrow from t_ctx) and pickup_time = '12:00'), 0, 'kuota jam lama dilepas');
select tests.as_user((select buyer_a from t_ctx));
select throws_ok($$select public.buyer_reschedule_order((select order_id from t_order_a), (select tomorrow from t_ctx), '15:00')$$,
  'P0001', 'already_rescheduled', 'geser hanya sekali');

-- 21 sampai 24. Menu habis: karyawan menandai, pembeli mengganti dengan yang lebih murah, selisih kembali.
select tests.as_user((select employee from t_ctx));
select lives_ok($$select public.seller_flag_item_sold_out((select id from public.order_items where order_id = (select order_id from t_order_a)))$$, 'karyawan menandai menu habis');
select tests.as_user((select buyer_a from t_ctx));
select is((select needs_buyer_action from public.orders where id = (select order_id from t_order_a)), true, 'pesanan perlu tindakan pembeli');
select lives_ok(
  $$select public.buyer_resolve_sold_out((select id from public.order_items where order_id = (select order_id from t_order_a) and status = 'habis_menunggu'),
    'ganti', (select spaghetti from t_ctx), '[]'::jsonb)$$,
  'pembeli mengganti dengan menu yang lebih murah'
);
select is((select refunded_total from public.orders where id = (select order_id from t_order_a)), (28000 - 23000) * 2, 'selisih harga kembali');

-- 25 sampai 26. Batal sebelum disiapkan: sisa uang kembali penuh, kuota dilepas.
select lives_ok($$select public.buyer_cancel_order((select order_id from t_order_a))$$, 'pembeli membatalkan sebelum disiapkan');
select is((select refunded_total = total_paid from public.orders where id = (select order_id from t_order_a)), true, 'seluruh uang kembali termasuk biaya layanan');

-- 27 sampai 30. Pesanan B: pengganti lebih mahal ditolak, hapus menu satu-satunya membatalkan pesanan.
select tests.as_user((select buyer_b from t_ctx));
create temporary table t_order_b as
  select * from public.create_order((select tenant from t_ctx), (select tomorrow from t_ctx), '16:00',
    jsonb_build_array(jsonb_build_object('menu_item_id', (select burger from t_ctx), 'quantity', 1)), 'Budi', 'makan_di_sini', false, null);
grant select on t_order_b to authenticated;
select tests.as_postgres();
select is((public.internal_confirm_payment((select payment_code from t_order_b)) ->> 'ok')::boolean, true, 'pesanan B lunas');
select tests.as_user((select employee from t_ctx));
select lives_ok($$select public.seller_flag_item_sold_out((select id from public.order_items where order_id = (select order_id from t_order_b)))$$, 'burger ditandai habis');
select tests.as_user((select buyer_b from t_ctx));
select throws_ok(
  $$select public.buyer_resolve_sold_out((select id from public.order_items where order_id = (select order_id from t_order_b) and status = 'habis_menunggu'),
    'ganti', (select grill from t_ctx), jsonb_build_array((select grill_level1 from t_ctx)))$$,
  'P0001', 'replacement_too_expensive', 'pengganti lebih mahal ditolak'
);
select lives_ok(
  $$select public.buyer_resolve_sold_out((select id from public.order_items where order_id = (select order_id from t_order_b) and status = 'habis_menunggu'), 'hapus')$$,
  'pembeli menghapus menu yang habis'
);

-- 31 sampai 32. Menu satu-satunya dihapus: pesanan batal, seluruh uang kembali.
select is((select status::text from public.orders where id = (select order_id from t_order_b)), 'dibatalkan', 'semua menu habis membatalkan pesanan');
select is((select refunded_total from public.orders where id = (select order_id from t_order_b)), 25000 + 1000, 'uang kembali penuh termasuk biaya layanan');

-- 33 sampai 36. Tutup hari dan setoran (pesanan kemarin yang belum selesai).
select tests.as_postgres();
insert into public.orders (tenant_id, buyer_id, buyer_name, pickup_date, pickup_time, pickup_at, pickup_name, dining, status,
  subtotal, service_fee, seller_fee, total_paid, payment_code, pay_deadline, pickup_code, order_number, paid_at, ready_at)
select tenant, buyer_a, 'Andi', private.today_wib() - 1, '10:00', private.wib_to_timestamptz(private.today_wib() - 1, '10:00'), 'Andi', 'bungkus', 'siap',
  20000, 1000, 1000, 21000, 'UJISP1', now(), 'AB23', 901, now(), now() from t_ctx;
insert into public.orders (tenant_id, buyer_id, buyer_name, pickup_date, pickup_time, pickup_at, pickup_name, dining, status,
  subtotal, service_fee, seller_fee, total_paid, payment_code, pay_deadline, pickup_code, order_number, paid_at)
select tenant, buyer_b, 'Budi', private.today_wib() - 1, '11:00', private.wib_to_timestamptz(private.today_wib() - 1, '11:00'), 'Budi', 'bungkus', 'diterima',
  30000, 1000, 1000, 31000, 'UJIDT1', now(), 'CD45', 902, now() from t_ctx;
select private.close_days();
select is((select status::text from public.orders where payment_code = 'UJISP1'), 'tidak_diambil', 'pesanan siap yang tidak diambil saat tutup');
select is((select status::text from public.orders where payment_code = 'UJIDT1'), 'dibatalkan', 'pesanan yang belum pernah siap dibatalkan saat tutup');
select is((select refunded_total from public.orders where payment_code = 'UJIDT1'), 31000, 'belum siap saat tutup: uang kembali penuh');
create temporary table t_payout as select private.create_payout((select tenant from t_ctx), private.today_wib()) as id;
select is(
  (select amount from public.payouts where id = (select id from t_payout)),
  20000 - 1000, 'setoran = penjualan dikurangi potongan Rp1.000, pesanan batal tidak dihitung'
);

-- 37 sampai 38. Uang kembali manual dari tim dibebankan ke tenant: penuh, Jaminin ikut mengembalikan Rp2.000.
update public.team_members set role = role;
insert into public.team_members (user_id, role) select tests.create_user('admin@uji.test'), 'admin';
select tests.as_user((select id from auth.users where email = 'admin@uji.test'));
select lives_ok($$select public.team_refund((select id from public.orders where payment_code = 'UJISP1'), true, null, 'tenant', 'Pesanan salah')$$, 'tim memberi uang kembali penuh');
select tests.as_postgres();
select is(
  (select row(tenant_charge, jaminin_charge)::text from public.refunds where order_id = (select id from public.orders where payment_code = 'UJISP1') and is_manual),
  row(21000 - 2000, 2000)::text, 'tenant menanggung bagiannya, Jaminin mengembalikan Rp2.000'
);

select * from finish();
rollback;
