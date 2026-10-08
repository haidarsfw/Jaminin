-- Skema dasar Jaminin: tipe, tabel, indeks, dan fungsi bantu.
-- Semua aturan jam memakai WIB (Asia/Jakarta). Uang dalam rupiah bulat (integer).

create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- Tipe

create type public.status_pengguna as enum ('mahasiswa', 'dosen', 'staf_binus', 'tamu', 'pekerja_kantin');
create type public.peran_tim as enum ('admin', 'staf');
create type public.status_tenant as enum ('menunggu', 'disetujui', 'ditolak', 'ditangguhkan');
create type public.peran_tenant as enum ('pemilik', 'karyawan');
create type public.jenis_tenant as enum ('makanan', 'minuman', 'keduanya');
create type public.pengelola_tenant as enum ('mandiri', 'pihak_kantin');
create type public.status_pesanan as enum (
  'menunggu_bayar', 'kedaluwarsa', 'diterima', 'disiapkan', 'siap', 'selesai', 'tidak_diambil', 'dibatalkan'
);
create type public.cara_makan as enum ('makan_di_sini', 'bungkus');
create type public.status_item as enum ('normal', 'habis_menunggu', 'diganti', 'dihapus');
create type public.penanggung as enum ('aturan', 'tenant', 'jaminin');
create type public.status_laporan as enum ('baru', 'diproses', 'selesai');
create type public.kategori_laporan as enum ('pesanan_salah', 'uang_belum_kembali', 'lainnya');
create type public.jenis_promo as enum ('persen', 'rupiah');

-- Fungsi bantu waktu (WIB)

create or replace function private.now_wib(p_now timestamptz default now())
returns timestamp
language sql
immutable
set search_path = ''
as $$ select (p_now at time zone 'Asia/Jakarta') $$;

create or replace function private.today_wib(p_now timestamptz default now())
returns date
language sql
immutable
set search_path = ''
as $$ select (p_now at time zone 'Asia/Jakarta')::date $$;

-- Membulatkan ke atas ke kelipatan 5 menit. 11.09 menjadi 11.10, 11.10 tetap 11.10.
create or replace function private.ceil_5min(p_ts timestamp)
returns timestamp
language sql
immutable
set search_path = ''
as $$
  select date_trunc('hour', p_ts)
    + make_interval(mins => (ceil((extract(minute from p_ts) + extract(second from p_ts) / 60.0) / 5.0) * 5)::int)
$$;

create or replace function private.wib_to_timestamptz(p_date date, p_time time)
returns timestamptz
language sql
immutable
set search_path = ''
as $$ select ((p_date + p_time) at time zone 'Asia/Jakarta') $$;

-- Kode tanpa karakter yang mirip (0, O, 1, I, L).
create or replace function private.random_code(p_len int)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(p_len);
  v_out text := '';
begin
  for i in 0 .. p_len - 1 loop
    v_out := v_out || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
  end loop;
  return v_out;
end;
$$;

-- Pengaturan aplikasi (satu baris)

create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  service_fee int not null default 1000 check (service_fee >= 0),
  seller_fee int not null default 1000 check (seller_fee >= 0),
  payment_window_minutes int not null default 5 check (payment_window_minutes between 1 and 60),
  sold_out_response_minutes int not null default 10 check (sold_out_response_minutes between 1 and 120),
  demo_mode boolean not null default false,
  vapid_public_key text,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1);

-- Konfigurasi internal per lingkungan (alamat Edge Function). Tidak terbuka lewat API.
create table private.config (
  key text primary key,
  value text not null
);

-- Profil

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 80),
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  status public.status_pengguna,
  language text not null default 'id' check (language in ('id', 'en')),
  reminder_minutes int not null default 5 check (reminder_minutes in (5, 10, 15)),
  is_suspended boolean not null default false,
  is_demo boolean not null default false,
  profile_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role public.peran_tim not null,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index team_members_added_by_idx on public.team_members (added_by);

-- Tenant

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(name) between 2 and 60),
  description text check (length(description) <= 300),
  kiosk_location text not null check (length(kiosk_location) between 1 and 80),
  whatsapp text not null check (whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  contact_person text not null check (length(contact_person) between 2 and 60),
  type public.jenis_tenant not null,
  managed_by public.pengelola_tenant not null default 'mandiri',
  manager_name text check (length(manager_name) <= 80),
  logo_path text,
  status public.status_tenant not null default 'menunggu',
  reject_reason text,
  terms_accepted_at timestamptz,
  order_cutoff_minutes int not null default 5 check (order_cutoff_minutes >= 0),
  base_quota int not null check (base_quota >= 1),
  paused_until timestamptz,
  paused_indefinitely boolean not null default false,
  daily_order_limit int check (daily_order_limit is null or daily_order_limit >= 1),
  payout_time time,
  announcement text check (length(announcement) <= 200),
  is_sample boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tenants_status_idx on public.tenants (status);
create index tenants_created_by_idx on public.tenants (created_by);
create index tenants_reviewed_by_idx on public.tenants (reviewed_by);

-- Rekening hanya terlihat oleh pemilik dan tim.
create table public.tenant_bank (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  bank_name text not null check (length(bank_name) between 2 and 40),
  account_number text not null check (account_number ~ '^[0-9+ -]{4,30}$'),
  account_holder text not null check (length(account_holder) between 2 and 80),
  updated_at timestamptz not null default now()
);

create table public.tenant_members (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.peran_tenant not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index tenant_members_user_idx on public.tenant_members (user_id);

create table public.tenant_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  open_time time not null,
  close_time time not null,
  check (close_time > open_time)
);
create index tenant_hours_tenant_idx on public.tenant_hours (tenant_id, weekday);

create table public.tenant_special_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  date date not null,
  is_closed boolean not null default false,
  open_time time,
  close_time time,
  note text check (length(note) <= 100),
  check (is_closed or (open_time is not null and close_time is not null and close_time > open_time))
);
create index tenant_special_hours_idx on public.tenant_special_hours (tenant_id, date);

create table public.tenant_quota_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  start_time time not null,
  end_time time not null,
  quota int not null check (quota >= 1),
  check (end_time > start_time)
);
create index tenant_quota_rules_tenant_idx on public.tenant_quota_rules (tenant_id);

create table public.tenant_day_closings (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  date date not null,
  closed_at timestamptz not null default now(),
  primary key (tenant_id, date)
);

-- Menu

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  sort_order int not null default 0,
  is_active boolean not null default true
);
create index menu_categories_tenant_idx on public.menu_categories (tenant_id);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  category_id uuid references public.menu_categories (id) on delete set null,
  name text not null check (length(name) between 1 and 60),
  description text check (length(description) <= 200),
  price int not null check (price >= 0),
  prep_minutes int not null check (prep_minutes >= 0),
  tags text[] not null default '{}' check (tags <@ array['pedas', 'vegetarian', 'dingin', 'panas', 'halal']::text[]),
  photo_path text,
  sold_out_date date,
  sold_out_indefinite boolean not null default false,
  daily_stock int check (daily_stock is null or daily_stock >= 0),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_items_tenant_idx on public.menu_items (tenant_id);
create index menu_items_category_idx on public.menu_items (category_id);

create table public.option_groups (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.menu_items (id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  min_select int not null default 0 check (min_select >= 0),
  max_select int not null default 1 check (max_select >= 1),
  sort_order int not null default 0,
  check (max_select >= min_select)
);
create index option_groups_item_idx on public.option_groups (item_id);

create table public.options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.option_groups (id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  price_delta int not null default 0 check (price_delta >= 0),
  sort_order int not null default 0,
  is_active boolean not null default true
);
create index options_group_idx on public.options (group_id);

create table public.promos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind public.jenis_promo not null,
  value int not null check (value > 0),
  weekdays smallint[] not null check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[] and cardinality(weekdays) >= 1),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  check (kind <> 'persen' or value <= 90)
);
create index promos_tenant_idx on public.promos (tenant_id);

-- Pesanan

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  buyer_name text not null,
  buyer_whatsapp text,
  pickup_date date not null,
  pickup_time time not null,
  pickup_at timestamptz not null,
  pickup_name text not null check (length(pickup_name) between 1 and 60),
  dining public.cara_makan not null,
  cutlery boolean not null default false,
  note text check (length(note) <= 200),
  status public.status_pesanan not null default 'menunggu_bayar',
  end_reason text,
  subtotal int not null check (subtotal >= 0),
  promo_id uuid references public.promos (id) on delete set null,
  promo_discount int not null default 0 check (promo_discount >= 0),
  service_fee int not null,
  seller_fee int not null,
  total_paid int not null check (total_paid >= 0),
  refunded_total int not null default 0 check (refunded_total >= 0),
  jaminin_fee_returned boolean not null default false,
  max_prep_minutes int not null default 0,
  payment_code text not null unique,
  pay_deadline timestamptz not null,
  pickup_code text,
  order_number int,
  paid_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  completed_by text check (completed_by in ('penjual', 'pembeli')),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  rescheduled_count int not null default 0 check (rescheduled_count between 0 and 1),
  original_pickup_at timestamptz,
  needs_buyer_action boolean not null default false,
  reminder_sent_at timestamptz,
  not_ready_notified_at timestamptz,
  payout_id uuid,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (refunded_total <= total_paid)
);
create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_tenant_date_idx on public.orders (tenant_id, pickup_date, pickup_time);
create index orders_status_idx on public.orders (status);
create index orders_pay_deadline_idx on public.orders (pay_deadline) where status = 'menunggu_bayar';
create index orders_promo_idx on public.orders (promo_id);
create index orders_cancelled_by_idx on public.orders (cancelled_by);
create index orders_payout_idx on public.orders (payout_id);
create unique index orders_pickup_code_uniq on public.orders (tenant_id, pickup_date, pickup_code) where pickup_code is not null;
create unique index orders_number_uniq on public.orders (tenant_id, pickup_date, order_number) where order_number is not null;
create unique index orders_one_unpaid_per_buyer on public.orders (buyer_id) where status = 'menunggu_bayar';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  name text not null,
  quantity int not null check (quantity between 1 and 20),
  unit_price int not null check (unit_price >= 0),
  line_total int not null check (line_total >= 0),
  prep_minutes int not null default 0,
  options jsonb not null default '[]',
  status public.status_item not null default 'normal',
  replaces_item_id uuid references public.order_items (id) on delete set null,
  sold_out_flagged_at timestamptz,
  resolution_deadline timestamptz,
  refunded_amount int not null default 0,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_menu_item_idx on public.order_items (menu_item_id);
create index order_items_replaces_idx on public.order_items (replaces_item_id);
create index order_items_pending_idx on public.order_items (resolution_deadline) where status = 'habis_menunggu';

-- Penghitung yang dikunci baris supaya dua pesanan tidak merebut kuota terakhir.
create table public.slot_usage (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  pickup_date date not null,
  pickup_time time not null,
  used int not null default 0 check (used >= 0),
  primary key (tenant_id, pickup_date, pickup_time)
);

create table public.daily_counters (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  pickup_date date not null,
  last_number int not null default 0,
  orders_count int not null default 0 check (orders_count >= 0),
  primary key (tenant_id, pickup_date)
);

create table public.stock_usage (
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  pickup_date date not null,
  used int not null default 0 check (used >= 0),
  primary key (menu_item_id, pickup_date)
);

create table public.payments (
  order_id uuid primary key references public.orders (id) on delete cascade,
  code text not null unique,
  amount int not null,
  status text not null default 'menunggu' check (status in ('menunggu', 'lunas', 'kedaluwarsa')),
  provider text not null default 'simulasi',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  payout_date date not null,
  orders_count int not null,
  gross_sales int not null,
  promo_total int not null,
  seller_fee_total int not null,
  refunds_charged int not null,
  amount int not null,
  bank_name text,
  account_number text,
  account_holder text,
  status text not null default 'terkirim_simulasi',
  is_sample boolean not null default false,
  sent_at timestamptz not null default now(),
  unique (tenant_id, payout_date)
);
alter table public.orders add constraint orders_payout_fk foreign key (payout_id) references public.payouts (id) on delete set null;

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  amount int not null check (amount > 0),
  kind text not null check (kind in ('penuh', 'sebagian')),
  reason_code text not null,
  reason_text text,
  bearer public.penanggung not null,
  tenant_charge int not null default 0,
  jaminin_charge int not null default 0,
  is_manual boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  charged_payout_id uuid references public.payouts (id) on delete set null,
  status text not null default 'selesai_simulasi',
  created_at timestamptz not null default now()
);
create index refunds_order_idx on public.refunds (order_id);
create index refunds_created_by_idx on public.refunds (created_by);
create index refunds_payout_idx on public.refunds (charged_payout_id);

-- Kabar

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  params jsonb not null default '{}',
  url text,
  push_status text not null default 'menunggu' check (push_status in ('menunggu', 'ditunda', 'digabung', 'terkirim', 'tanpa_langganan', 'gagal', 'tidak_dikirim')),
  deliver_after timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_deferred_idx on public.notifications (deliver_after) where push_status = 'ditunda';

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Laporan

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  category public.kategori_laporan not null,
  story text not null check (length(story) between 5 and 1000),
  photo_path text,
  status public.status_laporan not null default 'baru',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_order_idx on public.reports (order_id);
create index reports_buyer_idx on public.reports (buyer_id);
create index reports_status_idx on public.reports (status);

create table public.report_replies (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index report_replies_report_idx on public.report_replies (report_id);
create index report_replies_author_idx on public.report_replies (author_id);

-- Catatan aktivitas tim dan perubahan uang
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- updated_at otomatis
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger tenants_touch before update on public.tenants for each row execute function private.touch_updated_at();
create trigger menu_items_touch before update on public.menu_items for each row execute function private.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute function private.touch_updated_at();
create trigger reports_touch before update on public.reports for each row execute function private.touch_updated_at();

-- Profil dibuat otomatis saat akun dibuat. Nama awal diambil dari Google kalau ada.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
