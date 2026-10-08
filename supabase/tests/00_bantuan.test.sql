-- Fungsi bantu uji (tidak dibatalkan, dipakai berkas uji berikutnya): membuat pengguna dan berpindah peran.
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(p_email text, p_complete boolean default true)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email, '', now(), '{}',
    jsonb_build_object('full_name', 'Uji ' || p_email), now(), now());
  if p_complete then
    update public.profiles set whatsapp = '+6281234567890', status = 'mahasiswa' where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function tests.as_user(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end;
$$;

create or replace function tests.as_postgres()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select has_function('tests', 'create_user', array['text', 'boolean'], 'fungsi bantu uji tersedia');
select * from finish();
