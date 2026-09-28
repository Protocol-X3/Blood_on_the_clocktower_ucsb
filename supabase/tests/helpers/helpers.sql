-- Test helpers, loaded by tools/run-pgtap.ts inside each test's transaction
-- (everything here is rolled back after every test file).

create schema tests;
grant usage on schema tests to anon, authenticated;

-- The admin email the tests configure (PERM-02). Any real admin is demoted for
-- the duration of the test transaction, so the tests control who is admin.
insert into private.app_config (key, value) values ('admin_email', 'admin@test.botc')
on conflict (key) do update set value = excluded.value;
update public.profiles set permission = 'player' where permission = 'admin';

-- Creates a user the way Supabase Auth would, then sets their profile directly.
create function tests.create_user(
  p_name text,
  p_permission public.permission_level default 'player',
  p_guest boolean default false
) returns uuid
language plpgsql as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, aud, role, email, is_anonymous, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (uid, 'authenticated', 'authenticated',
          case when p_guest then null else p_name || '@test.botc' end,
          p_guest, '{}'::jsonb, '{}'::jsonb, now(), now());
  update public.profiles set nickname = left(p_name, 12) where id = uid;
  if p_permission <> 'player' and p_permission <> 'admin' then
    update public.profiles set permission = p_permission where id = uid;
  end if;
  return uid;
end $$;

-- Acts as a signed-in user until the next tests.logout().
create function tests.login(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Acts as a signed-out visitor.
create function tests.login_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

create function tests.logout() returns void
language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

grant execute on all functions in schema tests to anon, authenticated;

-- Runs a statement as a given actor and reports 'allow' or the error code, rolling back its effects.
create function tests.try_as(p_user uuid, p_sql text) returns text
language plpgsql as $$
declare
  outcome text;
begin
  begin
    if p_user is null then
      perform tests.login_anon();
    else
      perform tests.login(p_user);
    end if;
    execute p_sql;
    raise exception 'TRY_AS_ALLOWED';
  exception when others then
    outcome := case when sqlerrm = 'TRY_AS_ALLOWED' then 'allow' else sqlerrm end;
  end;
  perform tests.logout();
  return outcome;
end $$;
