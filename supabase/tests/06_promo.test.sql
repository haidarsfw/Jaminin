begin;
select plan(14);

update public.app_settings set demo_mode = true where id = 1;

create temporary table t_promo as
select
  tests.create_user('pemilik-promo@uji.test') as owner,
  tests.create_user('pembeli-promo@uji.test') as buyer,
  (select id from public.tenants where slug = 'mama-bento') as tenant,
  (select id from public.menu_items where name = 'Rice Bowl') as rice_bowl,
  (private.today_wib() + 1) as tomorrow;
grant select on t_promo to authenticated, anon;
insert into public.tenant_members (tenant_id, user_id, role) select tenant, owner, 'pemilik' from t_promo;

-- 1-4. Pemilik membuat promo; promo aktif yang tumpang tindih ditolak, yang tidak tumpang tindih boleh.
select tests.as_user((select owner from t_promo));
select lives_ok(
  $$insert into public.promos (tenant_id, kind, value, weekdays, start_time, end_time)
    values ((select tenant from t_promo), 'persen', 10, array[1,2,3,4,5,6,7]::smallint[], '14:00', '16:00')$$,
  'promo 10 persen jam 14.00 sampai 16.00'
);
select throws_ok(
  $$insert into public.promos (tenant_id, kind, value, weekdays, start_time, end_time)
    values ((select tenant from t_promo), 'rupiah', 5000, array[3]::smallint[], '15:00', '17:00')$$,
  'P0001', 'promo_overlap', 'promo yang tumpang tindih ditolak'
);
select lives_ok(
  $$insert into public.promos (tenant_id, kind, value, weekdays, start_time, end_time)
    values ((select tenant from t_promo), 'rupiah', 5000, array[1,2,3,4,5,6,7]::smallint[], '16:00', '17:00')$$,
  'promo rupiah jam 16.00 sampai 17.00 boleh'
);
select lives_ok(
  $$insert into public.promos (tenant_id, kind, value, weekdays, start_time, end_time, is_active)
    values ((select tenant from t_promo), 'persen', 50, array[1,2,3,4,5,6,7]::smallint[], '14:30', '15:00', false)$$,
  'promo nonaktif boleh tumpang tindih'
);

-- 5. Mengaktifkan promo nonaktif yang tumpang tindih ditolak.
select throws_ok(
  $$update public.promos set is_active = true where value = 50 and tenant_id = (select tenant from t_promo)$$,
  'P0001', 'promo_overlap', 'mengaktifkan promo yang tumpang tindih ditolak'
);

-- 6-7. Pilihan jam ambil menampilkan promo yang berlaku.
select tests.as_postgres();
select results_eq(
  $$select promo_kind::text, promo_value from public.get_slots((select tenant from t_promo), (select tomorrow from t_promo), 8) where slot_time = '14:00'$$,
  $$values ('persen', 10)$$, 'jam 14.00 menampilkan promo 10 persen'
);
select results_eq(
  $$select promo_kind::text, promo_value from public.get_slots((select tenant from t_promo), (select tomorrow from t_promo), 8) where slot_time = '16:00'$$,
  $$values ('rupiah', 5000)$$, 'jam 16.00 menampilkan promo Rp5.000'
);

-- 8-10. Potongan persen dibulatkan ke bawah dan dikunci di pesanan.
select tests.as_user((select buyer from t_promo));
create temporary table t_order_promo as
  select * from public.create_order((select tenant from t_promo), (select tomorrow from t_promo), '14:00',
    jsonb_build_array(jsonb_build_object('menu_item_id', (select rice_bowl from t_promo), 'quantity', 1)), 'Uji', 'bungkus', false, null);
grant select on t_order_promo to authenticated;
select tests.as_postgres();
select is((select promo_discount from public.orders where id = (select order_id from t_order_promo)), 2200, 'potongan 10 persen dari Rp22.000');
select is((select total_paid from t_order_promo), 22000 - 2200 + 1000, 'total = subtotal - potongan + biaya layanan');
select is((select seller_fee from public.orders where id = (select order_id from t_order_promo)), 1000, 'potongan penjual tetap Rp1.000');

-- 11-12. Pesanan berpromo tidak bisa digeser.
select public.internal_confirm_payment((select payment_code from t_order_promo));
select tests.as_user((select buyer from t_promo));
select throws_ok(
  $$select public.buyer_reschedule_order((select order_id from t_order_promo), (select tomorrow from t_promo), '17:30')$$,
  'P0001', 'promo_cannot_reschedule', 'pesanan berpromo tidak bisa digeser'
);
select tests.as_postgres();
select is((select status::text from public.orders where id = (select order_id from t_order_promo)), 'diterima', 'pesanan tetap diterima');

-- 13-14. Potongan rupiah tidak melebihi harga makanan.
update public.promos set value = 30000 where kind = 'rupiah' and tenant_id = (select tenant from t_promo);
select tests.as_user((select buyer from t_promo));
create temporary table t_order_rupiah as
  select * from public.create_order((select tenant from t_promo), (select tomorrow from t_promo), '16:00',
    jsonb_build_array(jsonb_build_object('menu_item_id', (select rice_bowl from t_promo), 'quantity', 1)), 'Uji', 'bungkus', false, null);
grant select on t_order_rupiah to authenticated;
select tests.as_postgres();
select is((select promo_discount from public.orders where id = (select order_id from t_order_rupiah)), 22000, 'potongan rupiah dibatasi harga makanan');
select is((select total_paid from t_order_rupiah), 1000, 'pembeli tetap membayar biaya layanan');

select * from finish();
rollback;
