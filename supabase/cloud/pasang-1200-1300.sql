-- Jalankan sekali di dashboard Supabase proyek jaminin: SQL Editor, New query, tempel seluruh isi berkas ini, lalu Run.
-- Isinya migrasi 20261008001200_rapikan_advisor dan 20261008001300_libur_dan_penangguhan, ditambah catatan riwayat
-- migrasinya. Semuanya satu transaksi: kalau ada galat, tidak ada yang berubah. Setelah berhasil, berkas ini tidak dipakai lagi.
begin;

-- Perbaikan dari advisor Supabase.

-- pg_net tidak bisa dipindah skema, jadi dibuat ulang di skema extensions. Fungsinya tetap di skema net.
drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;

-- Kebijakan tulis menu dan jadwal dipecah per aksi supaya SELECT hanya dinilai kebijakan baca.
-- Kebijakan baca sudah mencakup pemilik tenant, jadi hak akses tidak berubah.
drop policy menu_categories_write on public.menu_categories;
create policy menu_categories_insert on public.menu_categories for insert to authenticated
  with check ((select private.is_tenant_owner(tenant_id)));
create policy menu_categories_update on public.menu_categories for update to authenticated
  using ((select private.is_tenant_owner(tenant_id))) with check ((select private.is_tenant_owner(tenant_id)));
create policy menu_categories_delete on public.menu_categories for delete to authenticated
  using ((select private.is_tenant_owner(tenant_id)));

drop policy menu_items_write on public.menu_items;
create policy menu_items_insert on public.menu_items for insert to authenticated
  with check ((select private.is_tenant_owner(tenant_id)));
create policy menu_items_update on public.menu_items for update to authenticated
  using ((select private.is_tenant_owner(tenant_id))) with check ((select private.is_tenant_owner(tenant_id)));
create policy menu_items_delete on public.menu_items for delete to authenticated
  using ((select private.is_tenant_owner(tenant_id)));

drop policy option_groups_write on public.option_groups;
create policy option_groups_insert on public.option_groups for insert to authenticated
  with check ((select private.is_tenant_owner(private.item_tenant(item_id))));
create policy option_groups_update on public.option_groups for update to authenticated
  using ((select private.is_tenant_owner(private.item_tenant(item_id))))
  with check ((select private.is_tenant_owner(private.item_tenant(item_id))));
create policy option_groups_delete on public.option_groups for delete to authenticated
  using ((select private.is_tenant_owner(private.item_tenant(item_id))));

drop policy options_write on public.options;
create policy options_insert on public.options for insert to authenticated
  with check ((select private.is_tenant_owner(private.group_tenant(group_id))));
create policy options_update on public.options for update to authenticated
  using ((select private.is_tenant_owner(private.group_tenant(group_id))))
  with check ((select private.is_tenant_owner(private.group_tenant(group_id))));
create policy options_delete on public.options for delete to authenticated
  using ((select private.is_tenant_owner(private.group_tenant(group_id))));

drop policy promos_write on public.promos;
create policy promos_insert on public.promos for insert to authenticated
  with check ((select private.is_tenant_owner(tenant_id)));
create policy promos_update on public.promos for update to authenticated
  using ((select private.is_tenant_owner(tenant_id))) with check ((select private.is_tenant_owner(tenant_id)));
create policy promos_delete on public.promos for delete to authenticated
  using ((select private.is_tenant_owner(tenant_id)));

drop policy tenant_hours_write on public.tenant_hours;
create policy tenant_hours_insert on public.tenant_hours for insert to authenticated
  with check ((select private.is_tenant_owner(tenant_id)));
create policy tenant_hours_update on public.tenant_hours for update to authenticated
  using ((select private.is_tenant_owner(tenant_id))) with check ((select private.is_tenant_owner(tenant_id)));
create policy tenant_hours_delete on public.tenant_hours for delete to authenticated
  using ((select private.is_tenant_owner(tenant_id)));

drop policy tenant_quota_rules_write on public.tenant_quota_rules;
create policy tenant_quota_rules_insert on public.tenant_quota_rules for insert to authenticated
  with check ((select private.is_tenant_owner(tenant_id)));
create policy tenant_quota_rules_update on public.tenant_quota_rules for update to authenticated
  using ((select private.is_tenant_owner(tenant_id))) with check ((select private.is_tenant_owner(tenant_id)));
create policy tenant_quota_rules_delete on public.tenant_quota_rules for delete to authenticated
  using ((select private.is_tenant_owner(tenant_id)));

-- Libur, jam khusus, dan penangguhan tenant (ronde 39): pesanan lunas yang jam ambilnya tidak lagi berada di jam buka
-- dibatalkan otomatis dengan uang kembali penuh, potongan penjual tidak ditagih, dan pembeli diberi kabar.

-- Jam khusus dan libur juga berlaku untuk tenant contoh saat mode demo; jam demo hanya menggantikan jadwal mingguan.
create or replace function private.tenant_ranges(p_tenant uuid, p_date date)
returns table (open_time time, close_time time)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_sample boolean;
  v_demo boolean;
begin
  if exists (select 1 from public.tenant_special_hours sh where sh.tenant_id = p_tenant and sh.date = p_date) then
    if exists (select 1 from public.tenant_special_hours sh where sh.tenant_id = p_tenant and sh.date = p_date and sh.is_closed) then
      return;
    end if;
    return query
      select sh.open_time, sh.close_time from public.tenant_special_hours sh
      where sh.tenant_id = p_tenant and sh.date = p_date
      order by sh.open_time;
    return;
  end if;

  select t.is_sample into v_sample from public.tenants t where t.id = p_tenant;
  select s.demo_mode into v_demo from public.app_settings s where s.id = 1;
  if v_sample and v_demo then
    return query select time '06:00', time '22:00';
    return;
  end if;

  return query
    select h.open_time, h.close_time from public.tenant_hours h
    where h.tenant_id = p_tenant and h.weekday = extract(isodow from p_date)::smallint
    order by h.open_time;
end;
$$;

-- Jam ambil berada di salah satu rentang kalau tidak lebih awal dari jam buka dan paling lambat 5 menit sebelum tutup.
create or replace function private.time_in_ranges(p_time time, p_ranges jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(p_ranges, '[]'::jsonb)) r
    where p_time >= (r ->> 'open')::time and p_time <= (r ->> 'close')::time - interval '5 minutes'
  )
$$;

-- Pesanan aktif pada satu tanggal yang jam ambilnya tidak lagi berada di jam buka baru.
create or replace function private.orders_outside(p_tenant uuid, p_date date, p_closed boolean, p_ranges jsonb)
returns table (id uuid, paid boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.status <> 'menunggu_bayar'
  from public.orders o
  where o.tenant_id = p_tenant and o.pickup_date = p_date
    and o.status in ('menunggu_bayar', 'diterima', 'disiapkan', 'siap')
    and (p_closed or not private.time_in_ranges(o.pickup_time, p_ranges))
$$;

-- Jumlah pesanan lunas yang akan dibatalkan, ditunjukkan ke pemilik sebelum menyimpan libur atau jam khusus.
create or replace function public.owner_special_day_preview(p_tenant uuid, p_date date, p_closed boolean, p_ranges jsonb)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_tenant_owner(p_tenant) then
    raise exception 'not_tenant_owner';
  end if;
  return (select count(*) from private.orders_outside(p_tenant, p_date, p_closed, p_ranges) o where o.paid);
end;
$$;

-- Menyimpan libur atau jam khusus satu tanggal, lalu membatalkan pesanan yang jamnya tidak lagi buka.
-- Mengembalikan jumlah pesanan lunas yang dibatalkan.
create or replace function public.owner_set_special_day(p_tenant uuid, p_date date, p_closed boolean, p_ranges jsonb, p_note text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  o record;
  v_reason text := case when p_closed then 'libur' else 'jam_khusus' end;
  v_count int := 0;
begin
  if not private.is_tenant_owner(p_tenant) then
    raise exception 'not_tenant_owner';
  end if;
  if p_date < private.today_wib() then
    raise exception 'date_in_past';
  end if;
  if not p_closed and jsonb_array_length(coalesce(p_ranges, '[]'::jsonb)) = 0 then
    raise exception 'hours_required';
  end if;

  delete from public.tenant_special_hours where tenant_id = p_tenant and date = p_date;
  if p_closed then
    insert into public.tenant_special_hours (tenant_id, date, is_closed, note)
    values (p_tenant, p_date, true, nullif(trim(p_note), ''));
  else
    for r in select * from jsonb_array_elements(p_ranges) loop
      insert into public.tenant_special_hours (tenant_id, date, is_closed, open_time, close_time, note)
      values (p_tenant, p_date, false, (r ->> 'open')::time, (r ->> 'close')::time, nullif(trim(p_note), ''));
    end loop;
  end if;

  for o in select * from private.orders_outside(p_tenant, p_date, p_closed, p_ranges) loop
    if o.paid then
      perform private.cancel_paid_order(o.id, v_reason, auth.uid());
      v_count := v_count + 1;
    else
      perform private.expire_order(o.id, v_reason);
    end if;
  end loop;

  perform private.log('atur_jam_khusus', 'tenant', p_tenant,
    jsonb_build_object('date', p_date, 'closed', p_closed, 'ranges', p_ranges, 'cancelled', v_count));
  return v_count;
end;
$$;

-- Menghapus libur atau jam khusus satu tanggal, sehingga jadwal mingguan berlaku lagi. Tidak membatalkan apa pun.
create or replace function public.owner_clear_special_day(p_tenant uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_tenant_owner(p_tenant) then
    raise exception 'not_tenant_owner';
  end if;
  delete from public.tenant_special_hours where tenant_id = p_tenant and date = p_date;
  perform private.log('hapus_jam_khusus', 'tenant', p_tenant, jsonb_build_object('date', p_date));
end;
$$;

-- Jumlah pesanan lunas mulai hari ini yang akan dibatalkan kalau tenant ditangguhkan.
create or replace function public.team_suspension_preview(p_tenant uuid)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_team();
  return (
    select count(*) from public.orders o
    where o.tenant_id = p_tenant and o.pickup_date >= private.today_wib() and o.status in ('diterima', 'disiapkan', 'siap')
  );
end;
$$;

-- Tim menangguhkan atau mengaktifkan lagi tenant. Penangguhan membatalkan semua pesanan aktif mulai hari ini.
create or replace function public.team_set_tenant_suspended(p_tenant uuid, p_suspend boolean, p_reason text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.tenants;
  o record;
  v_count int := 0;
begin
  perform private.require_team();
  select * into t from public.tenants where id = p_tenant for update;
  if t.id is null then
    raise exception 'not_found';
  end if;

  if p_suspend then
    if t.status <> 'disetujui' then
      raise exception 'cannot_suspend';
    end if;
    if length(trim(coalesce(p_reason, ''))) = 0 then
      raise exception 'reason_required';
    end if;
    update public.tenants set status = 'ditangguhkan' where id = p_tenant;
    for o in
      select x.id, x.status from public.orders x
      where x.tenant_id = p_tenant and x.pickup_date >= private.today_wib()
        and x.status in ('menunggu_bayar', 'diterima', 'disiapkan', 'siap')
    loop
      if o.status = 'menunggu_bayar' then
        perform private.expire_order(o.id, 'ditangguhkan');
      else
        perform private.cancel_paid_order(o.id, 'ditangguhkan', auth.uid());
        v_count := v_count + 1;
      end if;
    end loop;
    perform private.notify_tenant(p_tenant, 'tenant_ditangguhkan',
      jsonb_build_object('tenant_name', t.name, 'reason', trim(p_reason)), '/penjual');
  else
    if t.status <> 'ditangguhkan' then
      raise exception 'cannot_reactivate';
    end if;
    update public.tenants set status = 'disetujui' where id = p_tenant;
    perform private.notify_tenant(p_tenant, 'tenant_diaktifkan', jsonb_build_object('tenant_name', t.name), '/penjual');
  end if;

  perform private.log(case when p_suspend then 'tangguhkan_tenant' else 'aktifkan_tenant' end, 'tenant', p_tenant,
    jsonb_build_object('reason', nullif(trim(coalesce(p_reason, '')), ''), 'cancelled', v_count));
  return v_count;
end;
$$;

revoke execute on function private.time_in_ranges(time, jsonb), private.orders_outside(uuid, date, boolean, jsonb)
  from public, anon, authenticated;
revoke execute on function public.owner_special_day_preview(uuid, date, boolean, jsonb),
  public.owner_set_special_day(uuid, date, boolean, jsonb, text), public.owner_clear_special_day(uuid, date),
  public.team_suspension_preview(uuid), public.team_set_tenant_suspended(uuid, boolean, text)
  from public, anon;
grant execute on function public.owner_special_day_preview(uuid, date, boolean, jsonb),
  public.owner_set_special_day(uuid, date, boolean, jsonb, text), public.owner_clear_special_day(uuid, date),
  public.team_suspension_preview(uuid), public.team_set_tenant_suspended(uuid, boolean, text)
  to authenticated;

insert into supabase_migrations.schema_migrations (version, name)
values ('20261008001200', 'rapikan_advisor'), ('20261008001300', 'libur_dan_penangguhan');

commit;
