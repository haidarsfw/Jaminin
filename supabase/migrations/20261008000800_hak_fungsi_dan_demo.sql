-- Fungsi di skema private tidak boleh dijalankan langsung, kecuali fungsi bantu yang dipakai RLS.
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public;

grant execute on function
  private.is_team(), private.is_admin(), private.tenant_role(uuid), private.is_tenant_member(uuid),
  private.is_tenant_owner(uuid), private.tenant_is_public(uuid), private.item_tenant(uuid), private.group_tenant(uuid),
  private.can_view_order(uuid), private.try_uuid(text)
  to anon, authenticated;

-- Akun demo dibuat langsung di database (tanpa email). Masuk ke akun demo lewat panel tim, bukan kata sandi.
create or replace function private.create_demo_user(
  p_email text, p_full_name text, p_demo_role text, p_demo_order int, p_whatsapp text, p_status public.status_pengguna
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', lower(p_email),
      extensions.crypt(encode(extensions.gen_random_bytes(24), 'hex'), extensions.gen_salt('bf')), now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'demo_role', p_demo_role, 'demo_order', p_demo_order),
      jsonb_build_object('full_name', p_full_name), now(), now(),
      '', '', '', '', '', '', '', ''
    );
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', lower(p_email), 'email_verified', true), 'email', now(), now(), now());
  end if;
  update public.profiles set full_name = p_full_name, whatsapp = p_whatsapp, status = p_status, is_demo = true where id = v_id;
  return v_id;
end;
$$;
