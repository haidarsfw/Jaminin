begin;
select plan(11);

update public.app_settings set demo_mode = true where id = 1;

create temporary table t_nilai as
select
  tests.create_user('pembeli-nilai@uji.test') as buyer,
  tests.create_user('pembeli-lain-nilai@uji.test') as other,
  tests.create_user('karyawan-nilai@uji.test') as staff,
  tests.create_user('pemilik-lain-nilai@uji.test') as other_owner,
  (select id from public.tenants where slug = 'mama-bento') as tenant,
  (select id from public.tenants where slug = 'good-moments-coffee') as other_tenant,
  (select id from public.menu_items where name = 'Rice Bowl') as rice_bowl,
  (private.today_wib() + 1) as tomorrow;
grant select on t_nilai to authenticated, anon;
insert into public.tenant_members (tenant_id, user_id, role)
select tenant, staff, 'karyawan'::public.peran_tenant from t_nilai
union all select other_tenant, other_owner, 'pemilik' from t_nilai;

select tests.as_user((select buyer from t_nilai));
create temporary table t_order_nilai as
  select * from public.create_order((select tenant from t_nilai), (select tomorrow from t_nilai), '12:00',
    jsonb_build_array(jsonb_build_object('menu_item_id', (select rice_bowl from t_nilai), 'quantity', 1)), 'Uji', 'bungkus', false, null);
grant select on t_order_nilai to authenticated;
select tests.as_postgres();
select public.internal_confirm_payment((select payment_code from t_order_nilai));

-- 1. Pesanan yang belum selesai belum bisa dinilai.
select tests.as_user((select buyer from t_nilai));
select throws_ok(
  $$select public.buyer_rate_order((select order_id from t_order_nilai), true, 'Enak')$$,
  'P0001', 'cannot_rate', 'pesanan belum selesai belum bisa dinilai'
);

-- 2-4. Setelah selesai, pembeli menilai sekali; penilaian kedua ditolak; pembeli lain tidak bisa menilai.
select tests.as_postgres();
update public.orders set status = 'selesai', completed_at = now() where id = (select order_id from t_order_nilai);
select tests.as_user((select buyer from t_nilai));
select lives_ok($$select public.buyer_rate_order((select order_id from t_order_nilai), true, '  Nasinya hangat  ')$$, 'pembeli menilai pesanan selesai');
select throws_ok(
  $$select public.buyer_rate_order((select order_id from t_order_nilai), false, 'Ganti pendapat')$$,
  'P0001', 'already_rated', 'penilaian tidak bisa diubah'
);
select tests.as_user((select other from t_nilai));
select throws_ok(
  $$select public.buyer_rate_order((select order_id from t_order_nilai), false, null)$$,
  'P0001', 'order_not_found', 'pembeli lain tidak bisa menilai'
);

-- 5. Komentar dirapikan dan isi penilaian tersimpan.
select tests.as_postgres();
select results_eq(
  $$select thumbs_up, comment from public.ratings where order_id = (select order_id from t_order_nilai)$$,
  $$values (true, 'Nasinya hangat')$$, 'penilaian tersimpan dengan komentar yang dirapikan'
);

-- 6-9. Yang bisa membaca: pembeli, anggota tenant; yang tidak: pembeli lain, pemilik tenant lain, tamu.
select tests.as_user((select buyer from t_nilai));
select is((select count(*)::int from public.ratings where order_id = (select order_id from t_order_nilai)), 1, 'pembeli melihat penilaiannya');
select tests.as_user((select staff from t_nilai));
select is((select count(*)::int from public.ratings where order_id = (select order_id from t_order_nilai)), 1, 'karyawan tenant melihat penilaian');
select tests.as_user((select other_owner from t_nilai));
select is((select count(*)::int from public.ratings where order_id = (select order_id from t_order_nilai)), 0, 'pemilik tenant lain tidak melihat');
select tests.as_anon();
select throws_ok($$select count(*) from public.ratings$$, '42501', null, 'tamu tidak bisa membaca penilaian');

-- 10-11. Tidak ada yang bisa menulis langsung ke tabel.
select tests.as_user((select buyer from t_nilai));
select throws_ok(
  $$update public.ratings set thumbs_up = false where order_id = (select order_id from t_order_nilai)$$,
  '42501', null, 'pembeli tidak bisa mengubah penilaian langsung'
);
select throws_ok(
  $$insert into public.ratings (order_id, tenant_id, buyer_id, thumbs_up) values (gen_random_uuid(), (select tenant from t_nilai), (select buyer from t_nilai), true)$$,
  '42501', null, 'pembeli tidak bisa menulis penilaian langsung'
);

select * from finish();
rollback;
