-- Proses otomatis tiap menit (pg_cron) dan pengiriman push lewat Edge Function (pg_net).

-- Rahasia internal untuk panggilan database ke Edge Function, disimpan terenkripsi di Vault.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'internal_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'internal_secret',
      'Rahasia panggilan database ke Edge Function kirim-kabar');
  end if;
end;
$$;

create or replace function private.internal_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = 'internal_secret' limit 1 $$;

create or replace function private.cfg(p_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$ select value from private.config where key = p_key $$;

create table private.job_errors (
  id bigint generated always as identity primary key,
  step text not null,
  message text,
  created_at timestamptz not null default now()
);

-- Memanggil Edge Function secara asinkron. Diam saja kalau alamat fungsi belum diatur di lingkungan ini.
create or replace function private.call_function(p_name text, p_body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := private.cfg('functions_url');
begin
  if v_url is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/' || p_name,
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-jaminin-secret', private.internal_secret()),
    timeout_milliseconds := 8000
  );
end;
$$;

create or replace function private.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.push_status = 'menunggu' then
    perform private.call_function('kirim-kabar', jsonb_build_object('notification_id', new.id));
  end if;
  return null;
end;
$$;

create trigger notifications_push
  after insert on public.notifications
  for each row execute function private.dispatch_push();

-- Data untuk Edge Function kirim-kabar. Hanya bisa dipanggil server dengan rahasia internal yang benar.
create or replace function public.internal_push_payload(p_notification uuid, p_secret text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  n public.notifications;
  v_lang text;
begin
  if p_secret is distinct from private.internal_secret() then
    raise exception 'forbidden';
  end if;
  select * into n from public.notifications where id = p_notification;
  if n.id is null then
    return null;
  end if;
  select language into v_lang from public.profiles where id = n.user_id;
  return jsonb_build_object(
    'id', n.id,
    'kind', n.kind,
    'params', n.params,
    'url', n.url,
    'language', coalesce(v_lang, 'id'),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      from public.push_subscriptions s where s.user_id = n.user_id
    ), '[]'::jsonb),
    'vapid_private', (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_keys' limit 1)
  );
end;
$$;

create or replace function public.internal_push_result(p_notification uuid, p_secret text, p_status text, p_gone_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is distinct from private.internal_secret() then
    raise exception 'forbidden';
  end if;
  update public.notifications set push_status = p_status where id = p_notification;
  if p_gone_ids is not null and cardinality(p_gone_ids) > 0 then
    delete from public.push_subscriptions where id = any (p_gone_ids);
  end if;
end;
$$;

-- Kunci VAPID dibuat sekali oleh Edge Function. Kunci privat hanya disimpan di Vault.
create or replace function public.internal_set_vapid(p_public text, p_keys_json text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from vault.secrets where name = 'vapid_keys') then
    return false;
  end if;
  perform vault.create_secret(p_keys_json, 'vapid_keys', 'Kunci VAPID untuk Web Push');
  update public.app_settings set vapid_public_key = p_public where id = 1;
  return true;
end;
$$;

create or replace function public.internal_secret_check(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select p_secret is not distinct from private.internal_secret() $$;

revoke execute on function public.internal_push_payload(uuid, text), public.internal_push_result(uuid, text, text, uuid[]),
  public.internal_set_vapid(text, text), public.internal_secret_check(text)
  from public, anon, authenticated;
grant execute on function public.internal_push_payload(uuid, text), public.internal_push_result(uuid, text, text, uuid[]),
  public.internal_set_vapid(text, text), public.internal_secret_check(text)
  to service_role;

-- Langkah-langkah otomatis ----------------------------------------------------------------------

create or replace function private.expire_unpaid()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select id from public.orders where status = 'menunggu_bayar' and pay_deadline < now() loop
    perform private.expire_order(r.id, 'waktu_habis');
  end loop;
end;
$$;

create or replace function private.auto_resolve_sold_out()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select oi.id from public.order_items oi join public.orders o on o.id = oi.order_id
    where oi.status = 'habis_menunggu' and oi.resolution_deadline <= now() and o.status in ('diterima', 'disiapkan')
  loop
    perform private.remove_item(r.id, 'menu_habis_otomatis');
  end loop;
end;
$$;

-- Tepat pada jam ambil, pesanan yang belum siap memberi tahu pembeli bahwa ia boleh membatalkan.
create or replace function private.notify_not_ready()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select id, buyer_id from public.orders
    where status in ('diterima', 'disiapkan') and pickup_at <= now() and not_ready_notified_at is null
  loop
    update public.orders set not_ready_notified_at = now() where id = r.id;
    perform private.notify(r.buyer_id, 'belum_siap_boleh_batal', private.order_params(r.id), '/pesanan/' || r.id);
  end loop;
end;
$$;

-- Pengingat jam ambil sesuai pilihan pembeli. Tidak dikirim kalau pesanan dibayar setelah waktu pengingatnya lewat.
create or replace function private.send_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in
    select o.id, o.buyer_id, p.reminder_minutes
    from public.orders o join public.profiles p on p.id = o.buyer_id
    where o.status in ('diterima', 'disiapkan', 'siap')
      and o.reminder_sent_at is null
      and now() >= o.pickup_at - make_interval(mins => p.reminder_minutes)
      and now() < o.pickup_at
      and o.paid_at <= o.pickup_at - make_interval(mins => p.reminder_minutes)
  loop
    update public.orders set reminder_sent_at = now() where id = r.id;
    perform private.notify(r.buyer_id, 'pengingat_jam_ambil',
      private.order_params(r.id) || jsonb_build_object('minutes', r.reminder_minutes), '/pesanan/' || r.id);
  end loop;
end;
$$;

-- Pesanan yang masuk di luar jam buka tidak berbunyi. Saat tenant buka, penjual mendapat satu ringkasan.
create or replace function private.release_deferred()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g record;
begin
  for g in
    select user_id, params ->> 'tenant_name' as tenant_name, count(*)::int as n
    from public.notifications
    where push_status = 'ditunda' and deliver_after <= now()
    group by user_id, params ->> 'tenant_name'
  loop
    update public.notifications set push_status = 'digabung'
      where user_id = g.user_id and push_status = 'ditunda' and deliver_after <= now()
        and params ->> 'tenant_name' is not distinct from g.tenant_name;
    perform private.notify(g.user_id, 'ringkasan_pesanan_masuk',
      jsonb_build_object('count', g.n, 'tenant_name', g.tenant_name), '/penjual');
  end loop;
end;
$$;

-- Tutup hari pada jam tutup rentang terakhir: siap jadi tidak diambil, belum pernah siap dibatalkan dengan uang kembali penuh.
create or replace function private.close_days()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  o record;
  v_close time;
begin
  for t in
    select distinct tenant_id, pickup_date from public.orders
    where status in ('diterima', 'disiapkan', 'siap') and pickup_date <= private.today_wib()
  loop
    v_close := coalesce(private.tenant_last_close(t.tenant_id, t.pickup_date), time '23:59');
    continue when now() < private.wib_to_timestamptz(t.pickup_date, v_close);
    for o in
      select id, status, buyer_id from public.orders
      where tenant_id = t.tenant_id and pickup_date = t.pickup_date and status in ('diterima', 'disiapkan', 'siap')
    loop
      if o.status = 'siap' then
        update public.orders set status = 'tidak_diambil', end_reason = 'tidak_diambil_saat_tutup' where id = o.id;
        perform private.notify(o.buyer_id, 'tidak_diambil', private.order_params(o.id), '/pesanan/' || o.id);
      else
        perform private.cancel_paid_order(o.id, 'belum_siap_saat_tutup', null);
      end if;
    end loop;
    insert into public.tenant_day_closings (tenant_id, date) values (t.tenant_id, t.pickup_date) on conflict do nothing;
  end loop;
end;
$$;

-- Setoran: menjumlahkan pesanan final yang belum disetor, dikurangi uang kembali yang dibebankan ke tenant.
create or replace function private.create_payout(p_tenant uuid, p_date date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
  v_gross int;
  v_promo int;
  v_fee int;
  v_refunds int;
  v_bank public.tenant_bank;
  v_id uuid;
  v_amount int;
begin
  select count(*)::int, coalesce(sum(subtotal), 0)::int, coalesce(sum(promo_discount), 0)::int, coalesce(sum(seller_fee), 0)::int
    into v_count, v_gross, v_promo, v_fee
    from public.orders
    where tenant_id = p_tenant and status in ('selesai', 'tidak_diambil') and payout_id is null and pickup_date <= p_date;
  select coalesce(sum(r.tenant_charge), 0)::int into v_refunds
    from public.refunds r join public.orders o on o.id = r.order_id
    where o.tenant_id = p_tenant and o.status in ('selesai', 'tidak_diambil') and r.tenant_charge > 0
      and r.charged_payout_id is null and o.pickup_date <= p_date;
  if v_count = 0 and v_refunds = 0 then
    return null;
  end if;
  select * into v_bank from public.tenant_bank where tenant_id = p_tenant;
  v_amount := v_gross - v_promo - v_fee - v_refunds;
  insert into public.payouts (tenant_id, payout_date, orders_count, gross_sales, promo_total, seller_fee_total, refunds_charged,
    amount, bank_name, account_number, account_holder, is_sample)
  values (p_tenant, p_date, v_count, v_gross, v_promo, v_fee, v_refunds, v_amount,
    v_bank.bank_name, v_bank.account_number, v_bank.account_holder,
    (select is_sample from public.tenants where id = p_tenant))
  returning id into v_id;
  update public.orders set payout_id = v_id
    where tenant_id = p_tenant and status in ('selesai', 'tidak_diambil') and payout_id is null and pickup_date <= p_date;
  update public.refunds r set charged_payout_id = v_id
    from public.orders o
    where o.id = r.order_id and o.tenant_id = p_tenant and o.status in ('selesai', 'tidak_diambil')
      and r.tenant_charge > 0 and r.charged_payout_id is null and o.pickup_date <= p_date;
  perform private.notify_tenant(p_tenant, 'setoran_terkirim',
    jsonb_build_object('amount', v_amount, 'date', p_date, 'orders', v_count), '/penjual/setoran');
  return v_id;
end;
$$;

-- Setoran harian pada jam setoran (awalnya jam tutup rentang terakhir), setelah tutup hari diproses.
create or replace function private.run_payouts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
  v_today date := private.today_wib();
  v_time time;
begin
  for t in select id, payout_time from public.tenants where status in ('disetujui', 'ditangguhkan') loop
    v_time := coalesce(t.payout_time, private.tenant_last_close(t.id, v_today));
    continue when v_time is null;
    continue when private.now_wib()::time < v_time;
    continue when exists (select 1 from public.payouts where tenant_id = t.id and payout_date = v_today);
    perform private.create_payout(t.id, v_today);
  end loop;
end;
$$;

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
    'release_deferred', 'close_days', 'run_payouts']
  loop
    begin
      execute format('select private.%I()', v_step);
    exception when others then
      insert into private.job_errors (step, message) values (v_step, sqlerrm);
    end;
  end loop;
end;
$$;

select cron.schedule('jaminin-tiap-menit', '* * * * *', 'select private.run_minutely()');
