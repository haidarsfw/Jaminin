-- Jadwal mingguan dan kuota per rentang diganti utuh dalam satu transaksi, supaya tidak ada keadaan setengah tersimpan.

-- Mengosongkan jadwal mingguan satu tenant sebelum diganti utuh.
create or replace function private.clear_tenant_hours(p_tenant uuid)
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.tenant_hours where tenant_id = p_tenant $$;

-- Mengosongkan aturan kuota per rentang satu tenant sebelum diganti utuh.
create or replace function private.clear_quota_rules(p_tenant uuid)
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.tenant_quota_rules where tenant_id = p_tenant $$;

create or replace function public.owner_set_hours(p_tenant uuid, p_hours jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h jsonb;
begin
  if not private.is_tenant_owner(p_tenant) then
    raise exception 'not_tenant_owner';
  end if;
  if jsonb_array_length(coalesce(p_hours, '[]'::jsonb)) = 0 then
    raise exception 'hours_required';
  end if;
  perform private.clear_tenant_hours(p_tenant);
  for h in select * from jsonb_array_elements(p_hours) loop
    insert into public.tenant_hours (tenant_id, weekday, open_time, close_time)
    values (p_tenant, (h ->> 'weekday')::smallint, (h ->> 'open')::time, (h ->> 'close')::time);
  end loop;
  perform private.log('ubah_jadwal', 'tenant', p_tenant, jsonb_build_object('hours', p_hours));
end;
$$;

create or replace function public.owner_set_quota_rules(p_tenant uuid, p_rules jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q jsonb;
begin
  if not private.is_tenant_owner(p_tenant) then
    raise exception 'not_tenant_owner';
  end if;
  perform private.clear_quota_rules(p_tenant);
  for q in select * from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) loop
    insert into public.tenant_quota_rules (tenant_id, start_time, end_time, quota)
    values (p_tenant, (q ->> 'start')::time, (q ->> 'end')::time, (q ->> 'quota')::int);
  end loop;
  perform private.log('ubah_kuota', 'tenant', p_tenant, jsonb_build_object('rules', p_rules));
end;
$$;

revoke execute on function private.clear_tenant_hours(uuid), private.clear_quota_rules(uuid) from public, anon, authenticated;
revoke execute on function public.owner_set_hours(uuid, jsonb), public.owner_set_quota_rules(uuid, jsonb) from public, anon;
grant execute on function public.owner_set_hours(uuid, jsonb), public.owner_set_quota_rules(uuid, jsonb) to authenticated;

-- Jam buka yang berlaku pada satu tanggal (jadwal mingguan, jam khusus, atau jam demo), untuk halaman tenant.
create or replace function public.tenant_day_ranges(p_tenant uuid, p_date date)
returns table (open_time time, close_time time)
language sql
stable
security definer
set search_path = ''
as $$
  select r.open_time, r.close_time from private.tenant_ranges(p_tenant, p_date) r
  where exists (select 1 from public.tenants t where t.id = p_tenant and t.status = 'disetujui')
     or private.is_tenant_member(p_tenant) or private.is_team()
  order by r.open_time
$$;

revoke execute on function public.tenant_day_ranges(uuid, date) from public;
grant execute on function public.tenant_day_ranges(uuid, date) to anon, authenticated;
