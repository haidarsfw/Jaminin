-- P1 nomor 7: favorit tenant dan menu milik pembeli (B29). Setiap baris berisi tepat satu tenant atau satu menu.

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((tenant_id is null) <> (menu_item_id is null))
);

create unique index favorites_tenant_uniq on public.favorites (user_id, tenant_id) where tenant_id is not null;
create unique index favorites_menu_uniq on public.favorites (user_id, menu_item_id) where menu_item_id is not null;
create index favorites_tenant_idx on public.favorites (tenant_id);
create index favorites_menu_idx on public.favorites (menu_item_id);

alter table public.favorites enable row level security;
revoke all on public.favorites from anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;

create policy favorites_read on public.favorites for select to authenticated
  using ((select auth.uid()) = user_id);
create policy favorites_insert on public.favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy favorites_delete on public.favorites for delete to authenticated
  using ((select auth.uid()) = user_id);
