-- P1 nomor 4: pengingat menyiapkan untuk penjual dan kabar pagi untuk pembeli.
begin;
select plan(12);

update public.app_settings set demo_mode = true where id = 1;

create temporary table t_ctx as
select
  tests.create_user('pagi-pembeli@uji.test') as buyer,
  tests.create_user('pagi-pemilik@uji.test') as owner,
  (select id from public.tenants where slug = 'rustic-grill-bbq') as tenant;
insert into public.tenant_members (tenant_id, user_id, role) select tenant, owner, 'pemilik' from t_ctx;

-- Pesanan lunas langsung dibuat di database dengan waktu yang diatur, sama seperti pola uji tutup hari.
create temporary sequence t_number start 9001;
create or replace function pg_temp.paid_order(p_code text, p_status text, p_pickup timestamptz, p_paid timestamptz, p_prep int)
returns uuid
language sql
as $$
  insert into public.orders (tenant_id, buyer_id, buyer_name, pickup_date, pickup_time, pickup_at, pickup_name, dining, status,
    subtotal, service_fee, seller_fee, total_paid, payment_code, pay_deadline, pickup_code, order_number, paid_at, max_prep_minutes)
  select tenant, buyer, 'Sari', private.today_wib(p_pickup), private.now_wib(p_pickup)::time, p_pickup, 'Sari', 'bungkus',
    p_status::public.status_pesanan, 20000, 1000, 1000, 21000, p_code, p_paid, private.random_code(4), nextval('pg_temp.t_number'), p_paid, p_prep
  from t_ctx
  returning id
$$;

create temporary table t_orders as
select
  -- Jam ambil 10 menit lagi, menyiapkan butuh 15 menit, dibayar 1 jam lalu: harus diingatkan.
  pg_temp.paid_order('UJIPR1', 'diterima', now() + interval '10 minutes', now() - interval '1 hour', 15) as due,
  -- Masih ada 40 menit sebelum harus mulai: belum diingatkan.
  pg_temp.paid_order('UJIPR2', 'diterima', now() + interval '55 minutes', now() - interval '1 hour', 15) as early,
  -- Sudah mulai disiapkan: tidak perlu diingatkan.
  pg_temp.paid_order('UJIPR3', 'disiapkan', now() + interval '10 minutes', now() - interval '1 hour', 15) as preparing,
  -- Baru dibayar setelah saat mulai menyiapkan lewat: penjual baru saja menerima kabar pesanan baru.
  pg_temp.paid_order('UJIPR4', 'diterima', now() + interval '10 minutes', now() - interval '1 minute', 15) as late_paid;

-- 1 sampai 5. Pengingat menyiapkan.
select private.send_prep_reminders();
select is((select count(*)::int from public.notifications n, t_ctx c where n.user_id = c.owner and n.kind = 'pengingat_menyiapkan'), 1,
  'hanya pesanan yang sudah waktunya disiapkan yang diingatkan');
select is((select (params ->> 'order_id')::uuid from public.notifications n, t_ctx c where n.user_id = c.owner and n.kind = 'pengingat_menyiapkan'),
  (select due from t_orders), 'pengingat menyebut pesanan yang tepat');
select is((select params ->> 'minutes' from public.notifications n, t_ctx c where n.user_id = c.owner and n.kind = 'pengingat_menyiapkan'), '15',
  'pengingat menyebut lama menyiapkan');
select is((select url from public.notifications n, t_ctx c where n.user_id = c.owner and n.kind = 'pengingat_menyiapkan'), '/penjual/dapur',
  'pengingat membuka layar dapur');
select private.send_prep_reminders();
select is((select count(*)::int from public.notifications n, t_ctx c where n.user_id = c.owner and n.kind = 'pengingat_menyiapkan'), 1,
  'pengingat hanya sekali per pesanan');

-- 6 sampai 9. Kabar pagi. Tenant contoh buka 06.00 sampai 22.00 selama mode demo.
create temporary table t_morning as
select
  -- Dipesan kemarin untuk jam ambil hari ini yang belum lewat: dapat kabar pagi.
  pg_temp.paid_order('UJIKP1', 'diterima', now() + interval '2 hours', now() - interval '1 day', 5) as yesterday,
  -- Dipesan hari ini: tidak perlu kabar pagi.
  pg_temp.paid_order('UJIKP22', 'diterima', now() + interval '2 hours', now() - interval '5 minutes', 5) as today;
select private.send_morning_news();
select is((select count(*)::int from public.notifications n, t_ctx c where n.user_id = c.buyer and n.kind = 'kabar_pagi'
  and (n.params ->> 'order_id')::uuid in (select yesterday from t_morning union select today from t_morning)), 1,
  'kabar pagi hanya untuk pesanan yang dibuat hari sebelumnya');
select is((select (params ->> 'order_id')::uuid from public.notifications n, t_ctx c where n.user_id = c.buyer and n.kind = 'kabar_pagi'
  and (n.params ->> 'order_id')::uuid = (select yesterday from t_morning)), (select yesterday from t_morning), 'kabar pagi menyebut pesanan yang tepat');
select private.send_morning_news();
select is((select count(*)::int from public.notifications n, t_ctx c where n.user_id = c.buyer and n.kind = 'kabar_pagi'
  and (n.params ->> 'order_id')::uuid = (select yesterday from t_morning)), 1, 'kabar pagi hanya sekali per pesanan');

-- Tenant yang belum buka hari ini tidak mengirim kabar pagi.
update public.app_settings set demo_mode = false where id = 1;
insert into public.tenant_special_hours (tenant_id, date, is_closed) select tenant, private.today_wib(), true from t_ctx;
create temporary table t_closed as
select pg_temp.paid_order('UJIKP333', 'diterima', now() + interval '2 hours', now() - interval '1 day', 5) as id;
select private.send_morning_news();
select is((select count(*)::int from public.notifications n where n.kind = 'kabar_pagi' and (n.params ->> 'order_id')::uuid = (select id from t_closed)), 0,
  'kabar pagi menunggu tenant buka');
update public.app_settings set demo_mode = true where id = 1;

-- 10 sampai 12. Proses tiap menit menjalankan kedua langkah baru tanpa galat.
select lives_ok($$select private.run_minutely()$$, 'proses tiap menit berjalan');
select is((select count(*)::int from private.job_errors where step in ('send_prep_reminders', 'send_morning_news') and created_at >= now()), 0,
  'tidak ada galat dari langkah baru');
select is((select prep_reminded_at is not null from public.orders where id = (select due from t_orders)), true, 'pesanan yang diingatkan diberi tanda');

select * from finish();
rollback;
