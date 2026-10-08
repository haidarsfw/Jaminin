-- Chat per pesanan (P1 nomor 2, ronde 39): pembeli dengan pemilik dan karyawan tenant. Ditutup 24 jam setelah pesanan
-- selesai, batal, atau tidak diambil. Tim hanya bisa membaca chat pesanan yang dilaporkan, sebagai bukti.
create table public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  from_tenant boolean not null,
  body text not null check (length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index order_messages_order_idx on public.order_messages (order_id, created_at);
create index order_messages_sender_idx on public.order_messages (sender_id);

alter table public.order_messages enable row level security;
create policy order_messages_read on public.order_messages for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.buyer_id = (select auth.uid()) or (o.paid_at is not null and (select private.is_tenant_member(o.tenant_id))))
    )
    or ((select private.is_team()) and exists (select 1 from public.reports r where r.order_id = order_messages.order_id))
  );
revoke all on public.order_messages from anon;
revoke insert, update, delete, truncate on public.order_messages from authenticated;
grant select on public.order_messages to authenticated;

-- Chat terbuka untuk pesanan yang sudah dibayar sampai 24 jam setelah status akhirnya.
create or replace function private.chat_open(p_order uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order and o.paid_at is not null
      and (
        o.status in ('diterima', 'disiapkan', 'siap')
        or (
          o.status in ('selesai', 'dibatalkan', 'tidak_diambil')
          and coalesce(case o.status when 'selesai' then o.completed_at when 'dibatalkan' then o.cancelled_at end, o.updated_at)
            > now() - interval '24 hours'
        )
      )
  )
$$;

create or replace function public.send_order_message(p_order uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.orders;
  v_from_tenant boolean;
  v_body text := trim(coalesce(p_body, ''));
  v_id uuid;
  v_params jsonb;
begin
  select * into v from public.orders where id = p_order;
  if v.id is null then
    raise exception 'order_not_found';
  end if;
  if v.buyer_id = auth.uid() then
    v_from_tenant := false;
  elsif v.paid_at is not null and private.is_tenant_member(v.tenant_id) then
    v_from_tenant := true;
  else
    raise exception 'order_not_found';
  end if;
  if length(v_body) = 0 or length(v_body) > 500 then
    raise exception 'message_invalid';
  end if;
  if not private.chat_open(p_order) then
    raise exception 'chat_closed';
  end if;

  insert into public.order_messages (order_id, sender_id, from_tenant, body)
  values (p_order, auth.uid(), v_from_tenant, v_body)
  returning id into v_id;

  -- Siaran hanya membawa id; isi pesan diambil lewat select yang dijaga RLS.
  perform private.send('order:' || p_order, 'message', jsonb_build_object('id', v_id));
  perform private.send('tenant:' || v.tenant_id, 'message', jsonb_build_object('order_id', p_order));

  -- Satu kabar per percakapan selama masih belum dibaca dalam 5 menit terakhir, supaya chat cepat tidak membanjiri.
  v_params := private.order_params(p_order) || jsonb_build_object('from', case when v_from_tenant then 'tenant' else 'buyer' end, 'snippet', left(v_body, 80));
  if v_from_tenant then
    if not exists (
      select 1 from public.notifications n
      where n.user_id = v.buyer_id and n.kind = 'chat_baru' and n.read_at is null
        and n.params ->> 'order_id' = p_order::text and n.created_at > now() - interval '5 minutes'
    ) then
      perform private.notify(v.buyer_id, 'chat_baru', v_params, '/pesanan/' || p_order);
    end if;
  elsif not exists (
    select 1 from public.notifications n join public.tenant_members tm on tm.user_id = n.user_id and tm.tenant_id = v.tenant_id
    where n.kind = 'chat_baru' and n.read_at is null
      and n.params ->> 'order_id' = p_order::text and n.created_at > now() - interval '5 minutes'
  ) then
    perform private.notify_tenant(v.tenant_id, 'chat_baru', v_params, '/penjual');
  end if;
  return v_id;
end;
$$;

revoke execute on function private.chat_open(uuid) from public, anon, authenticated;
revoke execute on function public.send_order_message(uuid, text) from public, anon;
grant execute on function public.send_order_message(uuid, text) to authenticated;
