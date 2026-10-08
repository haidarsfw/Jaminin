-- Hak akses: fungsi bantu peran dan RLS di semua tabel.
-- Perubahan penting (pesanan, bayar, uang kembali, setoran) hanya lewat fungsi, bukan tulis langsung.

create or replace function private.is_team()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.team_members where user_id = (select auth.uid())) $$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.team_members where user_id = (select auth.uid()) and role = 'admin') $$;

create or replace function private.tenant_role(p_tenant uuid)
returns public.peran_tenant
language sql
stable
security definer
set search_path = ''
as $$ select role from public.tenant_members where tenant_id = p_tenant and user_id = (select auth.uid()) $$;

create or replace function private.is_tenant_member(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.tenant_members where tenant_id = p_tenant and user_id = (select auth.uid())) $$;

create or replace function private.is_tenant_owner(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.tenant_members where tenant_id = p_tenant and user_id = (select auth.uid()) and role = 'pemilik') $$;

create or replace function private.tenant_is_public(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.tenants where id = p_tenant and status = 'disetujui') $$;

create or replace function private.item_tenant(p_item uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select tenant_id from public.menu_items where id = p_item $$;

create or replace function private.group_tenant(p_group uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select mi.tenant_id from public.option_groups og join public.menu_items mi on mi.id = og.item_id where og.id = p_group
$$;

create or replace function private.can_view_order(p_order uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order
      and (
        o.buyer_id = (select auth.uid())
        or (o.paid_at is not null and exists (select 1 from public.tenant_members tm where tm.tenant_id = o.tenant_id and tm.user_id = (select auth.uid())))
        or exists (select 1 from public.team_members t where t.user_id = (select auth.uid()))
      )
  )
$$;

grant execute on function private.is_team, private.is_admin, private.tenant_role, private.is_tenant_member,
  private.is_tenant_owner, private.tenant_is_public, private.item_tenant, private.group_tenant, private.can_view_order
  to anon, authenticated;

-- RLS menyala di semua tabel
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.team_members enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_bank enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_hours enable row level security;
alter table public.tenant_special_hours enable row level security;
alter table public.tenant_quota_rules enable row level security;
alter table public.tenant_day_closings enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.option_groups enable row level security;
alter table public.options enable row level security;
alter table public.promos enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.slot_usage enable row level security;
alter table public.daily_counters enable row level security;
alter table public.stock_usage enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.refunds enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reports enable row level security;
alter table public.report_replies enable row level security;
alter table public.audit_log enable row level security;

-- Tulis langsung dibatasi ke kolom yang memang boleh diubah pengguna.
revoke insert, update, delete on all tables in schema public from anon, authenticated;

create policy app_settings_read on public.app_settings for select to anon, authenticated using (true);

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_team()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
grant update (full_name, whatsapp, status, language, reminder_minutes) on public.profiles to authenticated;

create policy team_members_read on public.team_members for select to authenticated
  using ((select private.is_team()));

create policy tenants_read on public.tenants for select to anon, authenticated
  using (status = 'disetujui' or (select private.is_tenant_member(id)) or (select private.is_team()));
create policy tenants_update_owner on public.tenants for update to authenticated
  using ((select private.is_tenant_owner(id))) with check ((select private.is_tenant_owner(id)));
grant update (name, description, kiosk_location, whatsapp, contact_person, type, managed_by, manager_name, logo_path,
  order_cutoff_minutes, base_quota, daily_order_limit, payout_time, announcement) on public.tenants to authenticated;

create policy tenant_bank_read on public.tenant_bank for select to authenticated
  using ((select private.is_tenant_owner(tenant_id)) or (select private.is_team()));
create policy tenant_bank_write on public.tenant_bank for insert to authenticated
  with check ((select private.is_tenant_owner(tenant_id)));
create policy tenant_bank_update on public.tenant_bank for update to authenticated
  using ((select private.is_tenant_owner(tenant_id))) with check ((select private.is_tenant_owner(tenant_id)));
grant insert, update on public.tenant_bank to authenticated;

create policy tenant_members_read on public.tenant_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_tenant_member(tenant_id)) or (select private.is_team()));

-- Jadwal, kuota, dan menu: terbaca publik untuk tenant yang disetujui, ditulis oleh pemilik.
create policy tenant_hours_read on public.tenant_hours for select to anon, authenticated
  using ((select private.tenant_is_public(tenant_id)) or (select private.is_tenant_member(tenant_id)) or (select private.is_team()));
create policy tenant_hours_write on public.tenant_hours for all to authenticated
  using ((select private.is_tenant_owner(tenant_id))) with check ((select private.is_tenant_owner(tenant_id)));
grant insert, update, delete on public.tenant_hours to authenticated;

create policy tenant_special_hours_read on public.tenant_special_hours for select to anon, authenticated
  using ((select private.tenant_is_public(tenant_id)) or (select private.is_tenant_member(tenant_id)) or (select private.is_team()));

create policy tenant_quota_rules_read on public.tenant_quota_rules for select to anon, authenticated
  using ((select private.tenant_is_public(tenant_id)) or (select private.is_tenant_member(tenant_id)) or (select private.is_team()));
create policy tenant_quota_rules_write on public.tenant_quota_rules for all to authenticated
  using ((select private.is_tenant_owner(tenant_id))) with check ((select private.is_tenant_owner(tenant_id)));
grant insert, update, delete on public.tenant_quota_rules to authenticated;

create policy tenant_day_closings_read on public.tenant_day_closings for select to authenticated
  using ((select private.is_tenant_member(tenant_id)) or (select private.is_team()));

create policy menu_categories_read on public.menu_categories for select to anon, authenticated
  using ((select private.tenant_is_public(tenant_id)) or (select private.is_tenant_member(tenant_id)) or (select private.is_team()));
create policy menu_categories_write on public.menu_categories for all to authenticated
  using ((select private.is_tenant_owner(tenant_id))) with check ((select private.is_tenant_owner(tenant_id)));
grant insert, update, delete on public.menu_categories to authenticated;

create policy menu_items_read on public.menu_items for select to anon, authenticated
  using ((select private.tenant_is_public(tenant_id)) or (select private.is_tenant_member(tenant_id)) or (select private.is_team()));
create policy menu_items_write on public.menu_items for all to authenticated
  using ((select private.is_tenant_owner(tenant_id))) with check ((select private.is_tenant_owner(tenant_id)));
grant insert, delete on public.menu_items to authenticated;
grant update (category_id, name, description, price, prep_minutes, tags, photo_path, daily_stock, sort_order, is_active)
  on public.menu_items to authenticated;

create policy option_groups_read on public.option_groups for select to anon, authenticated
  using (
    (select private.tenant_is_public(private.item_tenant(item_id)))
    or (select private.is_tenant_member(private.item_tenant(item_id)))
    or (select private.is_team())
  );
create policy option_groups_write on public.option_groups for all to authenticated
  using ((select private.is_tenant_owner(private.item_tenant(item_id))))
  with check ((select private.is_tenant_owner(private.item_tenant(item_id))));
grant insert, update, delete on public.option_groups to authenticated;

create policy options_read on public.options for select to anon, authenticated
  using (
    (select private.tenant_is_public(private.group_tenant(group_id)))
    or (select private.is_tenant_member(private.group_tenant(group_id)))
    or (select private.is_team())
  );
create policy options_write on public.options for all to authenticated
  using ((select private.is_tenant_owner(private.group_tenant(group_id))))
  with check ((select private.is_tenant_owner(private.group_tenant(group_id))));
grant insert, update, delete on public.options to authenticated;

create policy promos_read on public.promos for select to anon, authenticated
  using ((select private.tenant_is_public(tenant_id)) or (select private.is_tenant_member(tenant_id)) or (select private.is_team()));
create policy promos_write on public.promos for all to authenticated
  using ((select private.is_tenant_owner(tenant_id))) with check ((select private.is_tenant_owner(tenant_id)));
grant insert, update, delete on public.promos to authenticated;

-- Penjual hanya melihat pesanan yang sudah dibayar.
create policy orders_read on public.orders for select to authenticated
  using (
    buyer_id = (select auth.uid())
    or (paid_at is not null and (select private.is_tenant_member(tenant_id)))
    or (select private.is_team())
  );

create policy order_items_read on public.order_items for select to authenticated
  using ((select private.can_view_order(order_id)));

create policy payments_read on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid())) or (select private.is_team()));

create policy payouts_read on public.payouts for select to authenticated
  using ((select private.is_tenant_member(tenant_id)) or (select private.is_team()));

-- Alasan uang kembali manual tidak dibuka ke penjual. Penjual melihat potongannya lewat rincian setoran.
create policy refunds_read on public.refunds for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid())) or (select private.is_team()));

create policy notifications_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant update (read_at) on public.notifications to authenticated;

create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant insert, delete on public.push_subscriptions to authenticated;

create policy reports_read on public.reports for select to authenticated
  using (buyer_id = (select auth.uid()) or (select private.is_team()));
create policy reports_insert_own on public.reports for insert to authenticated
  with check (
    buyer_id = (select auth.uid())
    and exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = (select auth.uid()) and o.paid_at is not null)
  );
grant insert (order_id, buyer_id, category, story, photo_path) on public.reports to authenticated;

create policy report_replies_read on public.report_replies for select to authenticated
  using (
    (select private.is_team())
    or exists (select 1 from public.reports r where r.id = report_id and r.buyer_id = (select auth.uid()))
  );

create policy audit_log_read on public.audit_log for select to authenticated
  using ((select private.is_team()));

-- Penyimpanan foto: logo tenant dan foto menu terbuka untuk dibaca, foto laporan hanya untuk tim dan pelapor.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tenant-media', 'tenant-media', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('report-photos', 'report-photos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy tenant_media_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'tenant-media');
create policy tenant_media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'tenant-media' and (select private.is_tenant_owner(((storage.foldername(name))[1])::uuid)));
create policy tenant_media_update on storage.objects for update to authenticated
  using (bucket_id = 'tenant-media' and (select private.is_tenant_owner(((storage.foldername(name))[1])::uuid)));
create policy tenant_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tenant-media' and (select private.is_tenant_owner(((storage.foldername(name))[1])::uuid)));

create policy report_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'report-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy report_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'report-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select private.is_team())));
