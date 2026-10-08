begin;
select plan(26);

update public.app_settings set demo_mode = true where id = 1;

create temporary table t_libur as
select
  tests.create_user('pemilik-libur@uji.test') as owner,
  tests.create_user('pembeli-libur-a@uji.test') as buyer_a,
  tests.create_user('pembeli-libur-b@uji.test') as buyer_b,
  tests.create_user('pembeli-libur-c@uji.test') as buyer_c,
  tests.create_user('staf-libur@uji.test') as staff,
  (select id from public.tenants where slug = 'mama-bento') as tenant,
  (select id from public.menu_items where name = 'Rice Bowl') as rice_bowl,
  (private.today_wib() + 1) as tomorrow,
  (private.today_wib() - 1) as yesterday;
grant select on t_libur to authenticated, anon;
insert into public.tenant_members (tenant_id, user_id, role) select tenant, owner, 'pemilik' from t_libur;
insert into public.team_members (user_id, role) select staff, 'staf' from t_libur;

create or replace function pg_temp.pesan(p_buyer uuid, p_time time, p_pay boolean) returns uuid
language plpgsql as $$
declare
  v record;
begin
  perform tests.as_user(p_buyer);
  select * into v from public.create_order((select tenant from t_libur), (select tomorrow from t_libur), p_time,
    jsonb_build_array(jsonb_build_object('menu_item_id', (select rice_bowl from t_libur), 'quantity', 1)), 'Uji', 'bungkus', false, null);
  perform tests.as_postgres();
  if p_pay then
    perform public.internal_confirm_payment(v.payment_code);
  end if;
  return v.order_id;
end;
$$;

create temporary table t_orders as
select pg_temp.pesan((select buyer_a from t_libur), '12:00', true) as a,
       pg_temp.pesan((select buyer_b from t_libur), '15:00', true) as b,
       pg_temp.pesan((select buyer_c from t_libur), '16:00', false) as c;
grant select on t_orders to authenticated;

-- 1-2. Pratinjau hanya untuk pemilik dan hanya menghitung pesanan lunas di luar jam baru.
select tests.as_user((select buyer_a from t_libur));
select throws_ok(
  $$select public.owner_special_day_preview((select tenant from t_libur), (select tomorrow from t_libur), false, '[{"open":"10:00","close":"14:00"}]')$$,
  'P0001', 'not_tenant_owner', 'pembeli tidak bisa melihat pratinjau'
);
select tests.as_user((select owner from t_libur));
select is(
  public.owner_special_day_preview((select tenant from t_libur), (select tomorrow from t_libur), false, '[{"open":"10:00","close":"14:00"}]'),
  1, 'jam khusus 10.00 sampai 14.00 membatalkan satu pesanan lunas (15.00)'
);

-- 3-4. Tanggal lewat dan jam khusus tanpa rentang ditolak.
select throws_ok(
  $$select public.owner_set_special_day((select tenant from t_libur), (select yesterday from t_libur), true, null, null)$$,
  'P0001', 'date_in_past', 'tanggal yang sudah lewat ditolak'
);
select throws_ok(
  $$select public.owner_set_special_day((select tenant from t_libur), (select tomorrow from t_libur), false, '[]', null)$$,
  'P0001', 'hours_required', 'jam khusus harus punya rentang'
);

-- 5-10. Jam khusus disimpan, pesanan di luar jam baru dibatalkan dengan uang kembali penuh.
select is(
  public.owner_set_special_day((select tenant from t_libur), (select tomorrow from t_libur), false, '[{"open":"10:00","close":"14:00"}]', 'Acara kampus'),
  1, 'satu pesanan lunas dibatalkan'
);
select tests.as_postgres();
select results_eq(
  $$select status::text, end_reason from public.orders where id = (select b from t_orders)$$,
  $$values ('dibatalkan', 'jam_khusus')$$, 'pesanan 15.00 batal karena jam khusus'
);
select is(
  (select refunded_total = total_paid from public.orders where id = (select b from t_orders)),
  true, 'uang kembali penuh termasuk biaya layanan'
);
select results_eq(
  $$select status::text, end_reason from public.orders where id = (select c from t_orders)$$,
  $$values ('kedaluwarsa', 'jam_khusus')$$, 'pesanan belum bayar di luar jam baru dilepas'
);
select is((select status::text from public.orders where id = (select a from t_orders)), 'diterima', 'pesanan 12.00 tetap berjalan');
select ok(
  exists (select 1 from public.notifications where user_id = (select buyer_b from t_libur) and kind = 'pesanan_dibatalkan'
    and (params ->> 'amount')::int > 0),
  'pembeli diberi kabar dengan jumlah uang kembali'
);

-- 11. Jam khusus berlaku juga untuk tenant contoh saat mode demo.
select is(
  (select max(slot_time) from public.get_slots((select tenant from t_libur), (select tomorrow from t_libur), 5)),
  '13:55'::time, 'jam ambil terakhir mengikuti jam khusus'
);

-- 12-14. Libur membatalkan semua pesanan lunas tanggal itu dan menutup jam ambil.
select tests.as_user((select owner from t_libur));
select is(
  public.owner_set_special_day((select tenant from t_libur), (select tomorrow from t_libur), true, null, 'Libur'),
  1, 'libur membatalkan pesanan 12.00'
);
select tests.as_postgres();
select is((select end_reason from public.orders where id = (select a from t_orders)), 'libur', 'alasan batal libur');
select is((select count(*)::int from public.get_slots((select tenant from t_libur), (select tomorrow from t_libur), 5)), 0, 'tidak ada jam ambil saat libur');

-- 15-16. Menghapus libur mengembalikan jam demo, tanpa membatalkan apa pun.
select tests.as_user((select owner from t_libur));
select lives_ok(
  $$select public.owner_clear_special_day((select tenant from t_libur), (select tomorrow from t_libur))$$,
  'pemilik bisa menghapus libur'
);
select tests.as_postgres();
select is(
  (select max(slot_time) from public.get_slots((select tenant from t_libur), (select tomorrow from t_libur), 5)),
  '21:55'::time, 'jam demo berlaku lagi'
);

-- 17-26. Penangguhan oleh tim membatalkan pesanan aktif dan menyembunyikan tenant.
create temporary table t_order_d as select pg_temp.pesan((select buyer_a from t_libur), '12:00', true) as d;
grant select on t_order_d to authenticated;

select tests.as_user((select buyer_a from t_libur));
select throws_ok(
  $$select public.team_set_tenant_suspended((select tenant from t_libur), true, 'Uji')$$,
  'P0001', 'not_team', 'pembeli tidak bisa menangguhkan tenant'
);
select tests.as_user((select staff from t_libur));
select is(public.team_suspension_preview((select tenant from t_libur)), 1, 'pratinjau penangguhan menghitung pesanan lunas');
select throws_ok(
  $$select public.team_set_tenant_suspended((select tenant from t_libur), true, ' ')$$,
  'P0001', 'reason_required', 'penangguhan butuh alasan'
);
select is(public.team_set_tenant_suspended((select tenant from t_libur), true, 'Melanggar aturan kebersihan'), 1, 'staf tim menangguhkan tenant');
select tests.as_postgres();
select is((select status::text from public.tenants where id = (select tenant from t_libur)), 'ditangguhkan', 'status tenant ditangguhkan');
select is((select end_reason from public.orders where id = (select d from t_order_d)), 'ditangguhkan', 'pesanan batal karena penangguhan');
select ok(
  exists (select 1 from public.notifications where user_id = (select owner from t_libur) and kind = 'tenant_ditangguhkan'),
  'pemilik diberi kabar penangguhan'
);
select tests.as_anon();
select is((select count(*)::int from public.tenants where id = (select tenant from t_libur)), 0, 'tenant ditangguhkan tidak terlihat pembeli');
select tests.as_user((select staff from t_libur));
select throws_ok(
  $$select public.team_set_tenant_suspended((select tenant from t_libur), true, 'Lagi')$$,
  'P0001', 'cannot_suspend', 'tenant yang sudah ditangguhkan tidak bisa ditangguhkan lagi'
);
select is(public.team_set_tenant_suspended((select tenant from t_libur), false, null), 0, 'tim mengaktifkan lagi tenant');

select * from finish();
rollback;
