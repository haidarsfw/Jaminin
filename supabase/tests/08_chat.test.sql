begin;
select plan(15);

update public.app_settings set demo_mode = true where id = 1;

create temporary table t_chat as
select
  tests.create_user('pembeli-chat@uji.test') as buyer,
  tests.create_user('karyawan-chat@uji.test') as staff,
  tests.create_user('orang-lain-chat@uji.test') as outsider,
  tests.create_user('staf-tim-chat@uji.test') as team,
  (select id from public.tenants where slug = 'mama-bento') as tenant,
  (select id from public.menu_items where name = 'Rice Bowl') as rice_bowl,
  (private.today_wib() + 1) as tomorrow;
grant select on t_chat to authenticated, anon;
insert into public.tenant_members (tenant_id, user_id, role) select tenant, staff, 'karyawan' from t_chat;
insert into public.team_members (user_id, role) select team, 'staf' from t_chat;

select tests.as_user((select buyer from t_chat));
create temporary table t_order_chat as
  select * from public.create_order((select tenant from t_chat), (select tomorrow from t_chat), '12:00',
    jsonb_build_array(jsonb_build_object('menu_item_id', (select rice_bowl from t_chat), 'quantity', 1)), 'Uji', 'bungkus', false, null);
grant select on t_order_chat to authenticated;

-- 1. Sebelum dibayar, chat belum terbuka.
select throws_ok($$select public.send_order_message((select order_id from t_order_chat), 'Halo')$$, 'P0001', 'chat_closed', 'chat belum terbuka sebelum bayar');

select tests.as_postgres();
select public.internal_confirm_payment((select payment_code from t_order_chat));

-- 2-3. Pembeli mengirim pesan; anggota tenant mendapat kabar.
select tests.as_user((select buyer from t_chat));
select lives_ok($$select public.send_order_message((select order_id from t_order_chat), '  Tolong tanpa sambal ya  ')$$, 'pembeli mengirim pesan');
select tests.as_postgres();
select is(
  (select count(*)::int from public.notifications where user_id = (select staff from t_chat) and kind = 'chat_baru'),
  1, 'karyawan tenant mendapat kabar chat baru'
);

-- 4. Pesan kedua dalam 5 menit tidak menambah kabar.
select tests.as_user((select buyer from t_chat));
select public.send_order_message((select order_id from t_order_chat), 'Terima kasih');
select tests.as_postgres();
select is(
  (select count(*)::int from public.notifications where user_id = (select staff from t_chat) and kind = 'chat_baru'),
  1, 'chat beruntun tidak membanjiri kabar'
);

-- 5-6. Karyawan membalas; pembeli mendapat kabar dari tenant.
select tests.as_user((select staff from t_chat));
select lives_ok($$select public.send_order_message((select order_id from t_order_chat), 'Siap, tanpa sambal')$$, 'karyawan membalas');
select tests.as_postgres();
select ok(
  exists (select 1 from public.notifications where user_id = (select buyer from t_chat) and kind = 'chat_baru' and params ->> 'from' = 'tenant'),
  'pembeli mendapat kabar balasan'
);

-- 7-8. Pesan tersimpan rapi dan terbaca oleh pembeli serta karyawan.
select tests.as_user((select buyer from t_chat));
select results_eq(
  $$select body, from_tenant from public.order_messages where order_id = (select order_id from t_order_chat) order by created_at$$,
  $$values ('Tolong tanpa sambal ya', false), ('Terima kasih', false), ('Siap, tanpa sambal', true)$$,
  'pembeli membaca seluruh percakapan'
);
select tests.as_user((select staff from t_chat));
select is((select count(*)::int from public.order_messages where order_id = (select order_id from t_order_chat)), 3, 'karyawan membaca percakapan');

-- 9-10. Orang lain tidak bisa membaca atau mengirim.
select tests.as_user((select outsider from t_chat));
select is((select count(*)::int from public.order_messages where order_id = (select order_id from t_order_chat)), 0, 'orang lain tidak bisa membaca');
select throws_ok($$select public.send_order_message((select order_id from t_order_chat), 'Ikut')$$, 'P0001', 'order_not_found', 'orang lain tidak bisa mengirim');

-- 11-12. Tim membaca chat hanya kalau pesanannya dilaporkan.
select tests.as_user((select team from t_chat));
select is((select count(*)::int from public.order_messages where order_id = (select order_id from t_order_chat)), 0, 'tim tidak membaca chat pesanan tanpa laporan');
select tests.as_postgres();
insert into public.reports (order_id, buyer_id, category, story)
  select order_id, (select buyer from t_chat), 'pesanan_salah', 'Masih ada sambalnya' from t_order_chat;
select tests.as_user((select team from t_chat));
select is((select count(*)::int from public.order_messages where order_id = (select order_id from t_order_chat)), 3, 'tim membaca chat pesanan yang dilaporkan');

-- 13. Tidak ada yang bisa menulis langsung ke tabel.
select tests.as_user((select buyer from t_chat));
select throws_ok(
  $$insert into public.order_messages (order_id, sender_id, from_tenant, body) values ((select order_id from t_order_chat), (select buyer from t_chat), false, 'Langsung')$$,
  '42501', null, 'tidak bisa menulis langsung'
);

-- 14. Pesan kosong ditolak.
select throws_ok($$select public.send_order_message((select order_id from t_order_chat), '   ')$$, 'P0001', 'message_invalid', 'pesan kosong ditolak');

-- 15. 24 jam setelah selesai, chat ditutup.
select tests.as_postgres();
update public.orders set status = 'selesai', completed_at = now() - interval '25 hours' where id = (select order_id from t_order_chat);
select tests.as_user((select buyer from t_chat));
select throws_ok($$select public.send_order_message((select order_id from t_order_chat), 'Masih bisa?')$$, 'P0001', 'chat_closed', 'chat ditutup 24 jam setelah selesai');

select * from finish();
rollback;
