-- P1 nomor 9: daftar tunggu jam penuh (B32, O10, usulan U18). Saat kuota jam itu terlepas dan jam itu masih memenuhi
-- rumus jam tercepat, semua pembeli di daftar tunggu diberi kabar bersamaan. Yang lebih dulu membayar mendapat tempat.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  pickup_date date not null,
  pickup_time time not null,
  max_prep int not null default 0 check (max_prep between 0 and 600),
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id, pickup_date, pickup_time)
);
create index waitlist_slot_idx on public.waitlist (tenant_id, pickup_date, pickup_time);

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
grant select, delete on public.waitlist to authenticated;
create policy waitlist_read on public.waitlist for select to authenticated
  using ((select auth.uid()) = user_id);
create policy waitlist_delete on public.waitlist for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Masuk daftar tunggu hanya untuk jam yang sedang penuh, hari ini atau besok. Lama menyiapkan keranjang ikut disimpan
-- supaya kabar hanya dikirim kalau jam itu masih bisa dipesan dengan isi keranjang tersebut.
create or replace function public.join_waitlist(p_tenant uuid, p_date date, p_time time, p_max_prep int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_status text;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_user and p.profile_completed_at is not null) then
    raise exception 'profile_incomplete';
  end if;
  if exists (select 1 from public.profiles p where p.id = v_user and p.is_suspended) then
    raise exception 'account_suspended';
  end if;
  if p_date not in (private.today_wib(), private.today_wib() + 1) then
    raise exception 'slot_closed';
  end if;
  select sl.status into v_status from private.slots(p_tenant, p_date, greatest(coalesce(p_max_prep, 0), 0)) sl where sl.slot_time = p_time;
  if v_status is null then
    raise exception 'slot_closed';
  end if;
  if v_status <> 'penuh' then
    raise exception 'slot_not_full';
  end if;
  insert into public.waitlist (user_id, tenant_id, pickup_date, pickup_time, max_prep)
  values (v_user, p_tenant, p_date, p_time, least(greatest(coalesce(p_max_prep, 0), 0), 600))
  on conflict (user_id, tenant_id, pickup_date, pickup_time) do update set notified_at = null, max_prep = excluded.max_prep;
end;
$$;
revoke execute on function public.join_waitlist(uuid, date, time, int) from public, anon;
grant execute on function public.join_waitlist(uuid, date, time, int) to authenticated;

-- Tiap menit: jam yang ada di daftar tunggu dan kini tersedia lagi memberi kabar ke semua yang menunggu.
-- Jam yang sudah lewat dihapus dari daftar tunggu.
create or replace function private.notify_waitlist()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w record;
begin
  delete from public.waitlist where private.wib_to_timestamptz(pickup_date, pickup_time) <= now();
  for w in
    select wl.id, wl.user_id, wl.tenant_id, wl.pickup_date, wl.pickup_time, t.slug, t.name
    from public.waitlist wl join public.tenants t on t.id = wl.tenant_id
    where wl.notified_at is null
      and exists (
        select 1 from private.slots(wl.tenant_id, wl.pickup_date, wl.max_prep) sl
        where sl.slot_time = wl.pickup_time and sl.status = 'tersedia'
      )
  loop
    update public.waitlist set notified_at = now() where id = w.id;
    perform private.notify(w.user_id, 'jam_tersedia',
      jsonb_build_object('tenant_name', w.name, 'pickup_date', w.pickup_date, 'pickup_time', to_char(w.pickup_time, 'HH24:MI')),
      '/tenant/' || w.slug);
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
    'send_prep_reminders', 'send_morning_news', 'notify_waitlist', 'release_deferred', 'close_days', 'run_payouts']
  loop
    begin
      execute format('select private.%I()', v_step);
    exception when others then
      insert into private.job_errors (step, message) values (v_step, sqlerrm);
    end;
  end loop;
end;
$$;
