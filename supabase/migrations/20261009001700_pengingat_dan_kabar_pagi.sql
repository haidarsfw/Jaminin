-- P1 nomor 4: pengingat menyiapkan untuk penjual (J18, O08), kabar pagi untuk pembeli (O07), dan sisa stok harian
-- untuk halaman tenant (J16). Stok harian dan batas pesanan per hari (J17) sudah dijaga database sejak migrasi 0100
-- sampai 0400: stok terpakai dicatat per tanggal ambil di stock_usage, jadi "terisi ulang pukul 00.00" terjadi dengan sendirinya.

alter table public.orders
  add column prep_reminded_at timestamptz,
  add column morning_notified_at timestamptz;

-- Pengingat menyiapkan: jam ambil dikurangi lama menyiapkan menu terlama di pesanan sudah lewat, tetapi pesanan
-- belum mulai disiapkan. Sekali per pesanan. Pesanan yang dibayar setelah saat itu tidak diingatkan, karena
-- penjual baru saja menerima kabar pesanan baru.
create or replace function private.send_prep_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select o.id, o.tenant_id, o.max_prep_minutes
    from public.orders o
    where o.status = 'diterima'
      and o.prep_reminded_at is null
      and not o.needs_buyer_action
      and now() >= o.pickup_at - make_interval(mins => o.max_prep_minutes)
      and now() < o.pickup_at
      and o.paid_at < o.pickup_at - make_interval(mins => o.max_prep_minutes)
  loop
    update public.orders set prep_reminded_at = now() where id = r.id;
    perform private.notify_tenant(r.tenant_id, 'pengingat_menyiapkan',
      private.order_params(r.id) || jsonb_build_object('minutes', r.max_prep_minutes), '/penjual/dapur');
  end loop;
end;
$$;

-- Kabar pagi: saat tenant buka di hari ambil, pembeli yang memesan sejak hari sebelumnya diberi tahu bahwa
-- pesanannya tercatat. Hanya pesanan yang belum disentuh penjual, dan tidak dikirim kalau jam ambilnya sudah lewat.
create or replace function private.send_morning_news()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_today date := private.today_wib();
  v_now time := private.now_wib()::time;
begin
  for r in
    select o.id, o.buyer_id
    from public.orders o
    where o.status = 'diterima'
      and o.pickup_date = v_today
      and o.morning_notified_at is null
      and o.paid_at is not null
      and private.today_wib(o.paid_at) < v_today
      and now() < o.pickup_at
      and exists (select 1 from private.tenant_ranges(o.tenant_id, v_today) tr where tr.open_time <= v_now)
  loop
    update public.orders set morning_notified_at = now() where id = r.id;
    perform private.notify(r.buyer_id, 'kabar_pagi', private.order_params(r.id), '/pesanan/' || r.id);
  end loop;
end;
$$;

-- Sisa stok harian per menu untuk hari ini dan besok, supaya halaman tenant menandai menu yang stoknya habis
-- sebelum pembeli memasukkannya ke keranjang. Tabel stock_usage tetap tertutup; hanya angka sisa yang dibuka.
create or replace function public.menu_stock(p_tenant uuid)
returns table (menu_item_id uuid, pickup_date date, remaining int)
language sql
stable
security definer
set search_path = ''
as $$
  select mi.id, d.day, greatest(mi.daily_stock - coalesce(su.used, 0), 0)
  from public.menu_items mi
  join public.tenants t on t.id = mi.tenant_id and t.status = 'disetujui'
  cross join (values (private.today_wib()), (private.today_wib() + 1)) as d(day)
  left join public.stock_usage su on su.menu_item_id = mi.id and su.pickup_date = d.day
  where mi.tenant_id = p_tenant and mi.is_active and mi.daily_stock is not null
$$;
revoke execute on function public.menu_stock(uuid) from public;
grant execute on function public.menu_stock(uuid) to anon, authenticated;

create or replace function private.run_minutely()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_step text;
begin
  foreach v_step in array array['expire_unpaid', 'auto_resolve_sold_out', 'notify_not_ready', 'send_reminders',
    'send_prep_reminders', 'send_morning_news', 'release_deferred', 'close_days', 'run_payouts']
  loop
    begin
      execute format('select private.%I()', v_step);
    exception when others then
      insert into private.job_errors (step, message) values (v_step, sqlerrm);
    end;
  end loop;
end;
$$;
