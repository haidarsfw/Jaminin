-- Kabar realtime: trigger database mengirim Broadcast ke channel privat. Klien memuat ulang data saat menerima sinyal.
-- Topik: user:<id>, order:<id>, tenant:<id>, team.

create or replace function private.try_uuid(p_text text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function private.try_uuid(text) to authenticated;

create or replace function private.send(p_topic text, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(p_payload, p_event, p_topic, true);
exception when others then
  insert into private.job_errors (step, message) values ('realtime_send', sqlerrm);
end;
$$;

create or replace function private.broadcast_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := jsonb_build_object('id', new.id, 'status', new.status, 'pickup_date', new.pickup_date);
begin
  perform private.send('order:' || new.id, 'order', v_payload);
  perform private.send('user:' || new.buyer_id, 'order', v_payload);
  if new.paid_at is not null then
    perform private.send('tenant:' || new.tenant_id, 'order', v_payload);
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'menunggu_bayar' or (tg_op = 'UPDATE' and old.status = 'menunggu_bayar') then
      perform private.send('team', 'payment', v_payload);
    end if;
  end if;
  return null;
end;
$$;

create trigger orders_broadcast
  after insert or update on public.orders
  for each row execute function private.broadcast_order();

create or replace function private.broadcast_order_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  o record;
begin
  select id, tenant_id, buyer_id, paid_at into o from public.orders where id = new.order_id;
  perform private.send('order:' || o.id, 'items', jsonb_build_object('id', o.id));
  if o.paid_at is not null then
    perform private.send('tenant:' || o.tenant_id, 'order', jsonb_build_object('id', o.id));
  end if;
  return null;
end;
$$;

create trigger order_items_broadcast
  after insert or update on public.order_items
  for each row execute function private.broadcast_order_item();

create or replace function private.broadcast_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.send('user:' || new.user_id, 'notification', jsonb_build_object('id', new.id, 'kind', new.kind));
  return null;
end;
$$;

create trigger notifications_broadcast
  after insert on public.notifications
  for each row execute function private.broadcast_notification();

create or replace function private.broadcast_tenant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.send('tenant:' || new.id, 'tenant', jsonb_build_object('id', new.id, 'status', new.status));
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    perform private.send('team', 'tenant', jsonb_build_object('id', new.id, 'status', new.status));
  end if;
  return null;
end;
$$;

create trigger tenants_broadcast
  after insert or update on public.tenants
  for each row execute function private.broadcast_tenant();

create or replace function private.broadcast_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report uuid;
  v_buyer uuid;
begin
  if tg_table_name = 'reports' then
    v_report := new.id;
    v_buyer := new.buyer_id;
  else
    v_report := new.report_id;
    select buyer_id into v_buyer from public.reports where id = new.report_id;
  end if;
  perform private.send('team', 'report', jsonb_build_object('id', v_report));
  perform private.send('user:' || v_buyer, 'report', jsonb_build_object('id', v_report));
  return null;
end;
$$;

create trigger reports_broadcast after insert or update on public.reports
  for each row execute function private.broadcast_report();
create trigger report_replies_broadcast after insert on public.report_replies
  for each row execute function private.broadcast_report();

create or replace function private.broadcast_payout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.send('tenant:' || new.tenant_id, 'payout', jsonb_build_object('id', new.id));
  perform private.send('team', 'payout', jsonb_build_object('id', new.id));
  return null;
end;
$$;

create trigger payouts_broadcast after insert on public.payouts
  for each row execute function private.broadcast_payout();

-- Siapa boleh mendengar topik apa.
create policy jaminin_realtime_read on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (
      (select realtime.topic()) = 'user:' || (select auth.uid())::text
      or (
        split_part((select realtime.topic()), ':', 1) = 'order'
        and (select private.can_view_order(private.try_uuid(split_part((select realtime.topic()), ':', 2))))
      )
      or (
        split_part((select realtime.topic()), ':', 1) = 'tenant'
        and (select private.is_tenant_member(private.try_uuid(split_part((select realtime.topic()), ':', 2))))
      )
      or ((select realtime.topic()) = 'team' and (select private.is_team()))
    )
  );
