begin;
select plan(14);

create temporary table t_akses as
select
  tests.create_user('pemilik-menu@uji.test') as owner,
  tests.create_user('karyawan-menu@uji.test') as staff,
  tests.create_user('pemilik-lain@uji.test') as other_owner,
  tests.create_user('pembeli-menu@uji.test') as buyer,
  (select id from public.tenants where slug = 'mama-bento') as tenant,
  (select id from public.tenants where slug = 'good-moments-coffee') as other_tenant,
  (select id from public.menu_items where name = 'Rice Bowl') as rice_bowl;
grant select on t_akses to authenticated, anon;

insert into public.tenant_members (tenant_id, user_id, role)
select tenant, owner, 'pemilik'::public.peran_tenant from t_akses
union all select tenant, staff, 'karyawan' from t_akses
union all select other_tenant, other_owner, 'pemilik' from t_akses;

-- 1. Tamu bisa membaca menu tenant yang disetujui.
select tests.as_anon();
select ok((select count(*) from public.menu_items where tenant_id = (select tenant from t_akses)) > 0,
  'tamu bisa membaca menu tenant yang disetujui');

-- 2-4. Pemilik bisa menambah, mengubah, dan menghapus kategori.
select tests.as_user((select owner from t_akses));
select lives_ok($$insert into public.menu_categories (tenant_id, name) values ((select tenant from t_akses), 'Uji kategori')$$,
  'pemilik bisa menambah kategori');
update public.menu_categories set name = 'Uji kategori 2' where name = 'Uji kategori';
select is((select count(*)::int from public.menu_categories where name = 'Uji kategori 2'), 1, 'pemilik bisa mengubah kategori');
delete from public.menu_categories where name = 'Uji kategori 2';
select is((select count(*)::int from public.menu_categories where name = 'Uji kategori 2'), 0, 'pemilik bisa menghapus kategori');

-- 5. Pemilik bisa mengubah harga menunya.
update public.menu_items set price = 26000 where id = (select rice_bowl from t_akses);
select is((select price from public.menu_items where id = (select rice_bowl from t_akses)), 26000, 'pemilik bisa mengubah harga');

-- 6. Pemilik bisa menambah grup pilihan dan pilihan di menunya.
insert into public.option_groups (item_id, name, min_select, max_select) values ((select rice_bowl from t_akses), 'Uji pedas', 0, 1);
select lives_ok($$insert into public.options (group_id, name) select id, 'Uji level 1' from public.option_groups where name = 'Uji pedas'$$,
  'pemilik bisa menambah pilihan');

-- 7. Karyawan tidak bisa mengubah harga.
select tests.as_user((select staff from t_akses));
update public.menu_items set price = 1 where id = (select rice_bowl from t_akses);
select tests.as_postgres();
select is((select price from public.menu_items where id = (select rice_bowl from t_akses)), 26000, 'karyawan tidak bisa mengubah harga');

-- 8-10. Karyawan tidak bisa menambah kategori, jadwal, atau promo.
select tests.as_user((select staff from t_akses));
select throws_ok($$insert into public.menu_categories (tenant_id, name) values ((select tenant from t_akses), 'Karyawan')$$,
  '42501', null, 'karyawan tidak bisa menambah kategori');
select throws_ok($$insert into public.tenant_hours (tenant_id, weekday, open_time, close_time) values ((select tenant from t_akses), 6, '08:00', '12:00')$$,
  '42501', null, 'karyawan tidak bisa menambah jadwal');
select throws_ok($$insert into public.promos (tenant_id, kind, value, weekdays, start_time, end_time) values ((select tenant from t_akses), 'persen', 10, array[1]::smallint[], '14:00', '15:00')$$,
  '42501', null, 'karyawan tidak bisa menambah promo');

-- 11. Pemilik tenant lain tidak bisa menghapus menu tenant ini.
select tests.as_user((select other_owner from t_akses));
delete from public.menu_items where id = (select rice_bowl from t_akses);
select tests.as_postgres();
select is((select count(*)::int from public.menu_items where id = (select rice_bowl from t_akses)), 1, 'pemilik tenant lain tidak bisa menghapus menu');

-- 12. Pembeli tidak bisa menghapus pilihan menu.
select tests.as_user((select buyer from t_akses));
delete from public.options where name = 'Uji level 1';
select tests.as_postgres();
select is((select count(*)::int from public.options where name = 'Uji level 1'), 1, 'pembeli tidak bisa menghapus pilihan');

-- 13-14. Tenant yang belum disetujui: tamu tidak melihat menunya, pemilik tetap melihat.
update public.tenants set status = 'menunggu' where id = (select tenant from t_akses);
select tests.as_anon();
select is((select count(*)::int from public.menu_items where tenant_id = (select tenant from t_akses)), 0,
  'tamu tidak melihat menu tenant yang belum disetujui');
select tests.as_user((select owner from t_akses));
select ok((select count(*) from public.menu_items where tenant_id = (select tenant from t_akses)) > 0,
  'pemilik tetap melihat menu tenant yang belum disetujui');

select * from finish();
rollback;
