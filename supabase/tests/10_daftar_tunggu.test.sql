-- P1 nomor 9: daftar tunggu jam penuh.
begin;
select plan(9);

update public.app_settings set demo_mode = true where id = 1;

create temporary table t_ctx as
select
  tests.create_user('tunggu-a@uji.test') as buyer_a,
  tests.create_user('tunggu-b@uji.test') as buyer_b,
  tests.create_user('tunggu-c@uji.test', false) as incomplete,
  (select id from public.tenants where slug = 'rustic-grill-bbq') as tenant,
  (select id from public.menu_items where name = 'Burger') as burger,
  (private.today_wib() + 1) as tomorrow;
grant select on t_ctx to authenticated;
insert into public.tenant_quota_rules (tenant_id, start_time, end_time, quota) select tenant, '14:00', '14:05', 1 from t_ctx;

-- Pembeli A mengambil kuota terakhir jam 14.00 besok (masih menunggu bayar, kuotanya tertahan).
select tests.as_user((select buyer_a from t_ctx));
create temporary table t_order as
  select * from public.create_order((select tenant from t_ctx), (select tomorrow from t_ctx), '14:00',
    jsonb_build_array(jsonb_build_object('menu_item_id', (select burger from t_ctx), 'quantity', 1)), 'Andi', 'bungkus', false, null);

-- 1 sampai 4. Masuk daftar tunggu hanya untuk jam yang penuh, dengan profil lengkap.
select tests.as_user((select buyer_b from t_ctx));
select throws_ok(
  $$select public.join_waitlist((select tenant from t_ctx), (select tomorrow from t_ctx), '15:00', 10)$$,
  'P0001', 'slot_not_full', 'jam yang masih tersedia tidak bisa ditunggu'
);
select lives_ok(
  $$select public.join_waitlist((select tenant from t_ctx), (select tomorrow from t_ctx), '14:00', 10)$$,
  'pembeli B masuk daftar tunggu jam penuh'
);
select is((select count(*)::int from public.waitlist), 1, 'pembeli hanya melihat daftar tunggunya sendiri');
select tests.as_user((select incomplete from t_ctx));
select throws_ok(
  $$select public.join_waitlist((select tenant from t_ctx), (select tomorrow from t_ctx), '14:00', 10)$$,
  'P0001', 'profile_incomplete', 'profil harus lengkap'
);

-- 5. Selama jam masih penuh, tidak ada kabar.
select tests.as_postgres();
select private.notify_waitlist();
select is((select count(*)::int from public.notifications n, t_ctx c where n.user_id = c.buyer_b and n.kind = 'jam_tersedia'), 0,
  'belum ada kabar selama jam penuh');

-- 6 sampai 8. Pesanan A gugur, kuota terlepas, pembeli B dikabari sekali.
update public.orders set pay_deadline = now() - interval '1 minute' where id = (select order_id from t_order);
select private.expire_unpaid();
select private.notify_waitlist();
select is((select count(*)::int from public.notifications n, t_ctx c where n.user_id = c.buyer_b and n.kind = 'jam_tersedia'), 1,
  'pembeli di daftar tunggu dikabari saat kuota terlepas');
select is((select url from public.notifications n, t_ctx c where n.user_id = c.buyer_b and n.kind = 'jam_tersedia'), '/tenant/rustic-grill-bbq',
  'kabar membuka halaman tenant');
select private.notify_waitlist();
select is((select count(*)::int from public.notifications n, t_ctx c where n.user_id = c.buyer_b and n.kind = 'jam_tersedia'), 1,
  'kabar hanya sekali');

-- 9. Jam yang sudah lewat dihapus dari daftar tunggu.
update public.waitlist set pickup_date = private.today_wib() - 1;
select private.notify_waitlist();
select is((select count(*)::int from public.waitlist), 0, 'jam yang sudah lewat dibersihkan');

select * from finish();
rollback;
