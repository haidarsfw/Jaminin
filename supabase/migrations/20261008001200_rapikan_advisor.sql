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
