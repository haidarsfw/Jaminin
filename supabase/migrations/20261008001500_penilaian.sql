-- Penilaian setelah pesanan selesai (P1 B25): jempol atas atau bawah dan komentar singkat, sekali per pesanan dan
-- tidak bisa diubah (ronde 42). Hanya pembelinya, anggota tenant, dan tim yang bisa membacanya.
create table public.ratings (
  order_id uuid primary key references public.orders (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  thumbs_up boolean not null,
  comment text check (length(comment) <= 200),
  created_at timestamptz not null default now()
);
create index ratings_tenant_idx on public.ratings (tenant_id, created_at desc);
create index ratings_buyer_idx on public.ratings (buyer_id);

alter table public.ratings enable row level security;
create policy ratings_read on public.ratings for select to authenticated
  using (buyer_id = (select auth.uid()) or (select private.is_tenant_member(tenant_id)) or (select private.is_team()));
revoke all on public.ratings from anon;
revoke insert, update, delete, truncate on public.ratings from authenticated;
grant select on public.ratings to authenticated;

create or replace function public.buyer_rate_order(p_order uuid, p_thumbs_up boolean, p_comment text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.orders;
begin
  select * into v from public.orders where id = p_order and buyer_id = auth.uid();
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  if v.status <> 'selesai' then
    raise exception 'cannot_rate';
  end if;
  if length(coalesce(p_comment, '')) > 200 then
    raise exception 'comment_too_long';
  end if;
  insert into public.ratings (order_id, tenant_id, buyer_id, thumbs_up, comment)
  values (v.id, v.tenant_id, v.buyer_id, p_thumbs_up, nullif(trim(coalesce(p_comment, '')), ''))
  on conflict (order_id) do nothing;
  if not found then
    raise exception 'already_rated';
  end if;
  perform private.log('beri_penilaian', 'order', v.id, jsonb_build_object('thumbs_up', p_thumbs_up));
end;
$$;

revoke execute on function public.buyer_rate_order(uuid, boolean, text) from public, anon;
grant execute on function public.buyer_rate_order(uuid, boolean, text) to authenticated;
