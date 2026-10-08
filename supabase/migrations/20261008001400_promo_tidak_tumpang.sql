-- Promo jam sepi aktif satu tenant tidak boleh tumpang tindih hari dan jamnya, supaya potongan yang ditampilkan
-- di pilihan jam ambil selalu sama dengan potongan yang ditagih saat pesanan dibuat.
create or replace function private.check_promo_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active and exists (
    select 1 from public.promos p
    where p.tenant_id = new.tenant_id and p.id <> new.id and p.is_active
      and p.weekdays && new.weekdays
      and p.start_time < new.end_time and new.start_time < p.end_time
  ) then
    raise exception 'promo_overlap';
  end if;
  return new;
end;
$$;

create trigger promos_no_overlap
  before insert or update on public.promos
  for each row execute function private.check_promo_overlap();

revoke execute on function private.check_promo_overlap() from public, anon, authenticated;
