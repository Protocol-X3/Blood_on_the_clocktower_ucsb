-- SCRIPT-07: the script-from-photo tools (M6) reach the database over HTTPS with a
-- single-purpose import token, so they also work in cloud sessions, whose proxy carries
-- only web traffic. With the token they can read the role library and save a script
-- (custom roles included) as the admin, through the same RPCs and checks as the editor.
-- Nothing else. Only the token's SHA-256 is stored (private.app_config
-- 'script_import_token_sha256', set with `node tools/db.ts import-token`); replacing it
-- revokes the old token.

-- The admin, if the token matches. Constant work per call; a 256-bit token can't be guessed.
create function private.script_import_admin(p_token text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hash text := (select value from private.app_config where key = 'script_import_token_sha256');
  v_admin uuid;
begin
  if v_hash is null or p_token is null or char_length(p_token) < 32
     or encode(sha256(convert_to(p_token, 'UTF8')), 'hex') <> v_hash then
    perform private.fail('IMPORT_TOKEN_INVALID');
  end if;
  select u.id into v_admin from auth.users u
  where not coalesce(u.is_anonymous, false) and private.is_admin_email(u.email);
  if v_admin is null then
    perform private.fail('ADMIN_NOT_SIGNED_IN');
  end if;
  return v_admin;
end $$;

-- The whole role library, for compare-script.
create function public.script_import_library(p_token text)
returns table (id text, name text, team text, ability text, edition text, is_official boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.script_import_admin(p_token);
  return query select r.id, r.name, r.team::text, r.ability, r.edition, r.is_official
               from public.roles r order by r.is_official desc, r.id;
end $$;

-- Saves a script, as the admin. p_spec:
--   {"name": "钟声来了", "author": "Bruce C." | null, "replace": false,
--    "roles": ["clockmaker", {"custom": {"name": "卡牌大师", "team": "townsfolk", "ability": "…", "glyph": "牌", "reminders": []}}, …]}
-- Returns the script as saved: {"script", "replaced", "dry_run", "roles": [{position, id, name, team, edition, is_official, created}]}.
-- p_dry_run does all of it, returns the result, and rolls it back.
create function public.import_script(p_token text, p_spec jsonb, p_dry_run boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := private.script_import_admin(p_token);
  v_claims text := current_setting('request.jwt.claims', true);
  v_sub text := current_setting('request.jwt.claim.sub', true);
  v_name text;
  v_existing uuid;
  v_replace boolean;
  v_item jsonb;
  v_custom jsonb;
  v_ids text[] := '{}';
  v_created text[] := '{}';
  v_id text;
  v_script uuid;
  v_result jsonb;
begin
  if p_spec is null or jsonb_typeof(p_spec) <> 'object' or jsonb_typeof(p_spec -> 'roles') is distinct from 'array'
     or jsonb_typeof(p_spec -> 'name') is distinct from 'string' then
    perform private.fail('IMPORT_SPEC_INVALID');
  end if;
  if jsonb_typeof(coalesce(p_spec -> 'replace', 'null')) not in ('boolean', 'null')
     or jsonb_typeof(coalesce(p_spec -> 'author', 'null')) not in ('string', 'null') then
    perform private.fail('IMPORT_SPEC_INVALID');
  end if;
  v_name := btrim(p_spec ->> 'name');
  v_replace := coalesce((p_spec ->> 'replace')::boolean, false);
  -- A name already in use needs the owner's decision: replace it, rename, or stop.
  select s.id into v_existing from public.scripts s where s.name = v_name;
  if v_existing is not null and not v_replace then
    perform private.fail('SCRIPT_NAME_TAKEN');
  end if;
  if v_existing is null and v_replace then
    perform private.fail('SCRIPT_NOT_FOUND');
  end if;

  -- Act as the admin for the editor's RPCs, so their checks apply and the admin owns the result.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  begin
    for v_item in select * from jsonb_array_elements(p_spec -> 'roles') loop
      if jsonb_typeof(v_item) = 'string' then
        v_ids := v_ids || (v_item #>> '{}');
      elsif jsonb_typeof(v_item -> 'custom') = 'object' then
        v_custom := v_item -> 'custom';
        -- A 自制角色 made for an earlier script is reused by its id, never created twice.
        if exists (select 1 from public.roles r where r.name = btrim(v_custom ->> 'name')) then
          perform private.fail('ROLE_NAME_TAKEN');
        end if;
        if jsonb_typeof(coalesce(v_custom -> 'reminders', '[]')) <> 'array'
           or coalesce(v_custom ->> 'team', '') not in ('townsfolk', 'outsider', 'minion', 'demon') then
          perform private.fail('IMPORT_SPEC_INVALID');
        end if;
        v_id := public.create_custom_role(
          v_custom ->> 'name',
          (v_custom ->> 'team')::public.team,
          v_custom ->> 'ability',
          v_custom ->> 'glyph',
          array(select jsonb_array_elements_text(coalesce(v_custom -> 'reminders', '[]'))));
        v_ids := v_ids || v_id;
        v_created := v_created || v_id;
      else
        perform private.fail('IMPORT_SPEC_INVALID');
      end if;
    end loop;
    v_script := public.save_script(v_existing, v_name, p_spec ->> 'author', v_ids);

    -- Read it back: every role, in order, with its team and collection.
    select jsonb_build_object(
      'script', v_script,
      'replaced', v_existing is not null,
      'dry_run', p_dry_run,
      'roles', coalesce(jsonb_agg(jsonb_build_object(
        'position', sr.position, 'id', r.id, 'name', r.name, 'team', r.team, 'edition', r.edition,
        'is_official', r.is_official, 'created', r.id = any (v_created)) order by sr.position), '[]'))
    into v_result
    from public.script_roles sr join public.roles r on r.id = sr.role_id
    where sr.script_id = v_script;

    if p_dry_run then
      raise exception using errcode = 'BT001', message = 'IMPORT_DRY_RUN';
    end if;
  exception when sqlstate 'BT001' then
    null; -- the dry run's changes are rolled back; v_result keeps what was built
  end;

  perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  return v_result;
end $$;

revoke execute on function private.script_import_admin(text) from public, anon, authenticated;
-- The token is the credential: anyone may call these, and without it they refuse.
revoke execute on function public.script_import_library(text), public.import_script(text, jsonb, boolean) from public;
grant execute on function public.script_import_library(text), public.import_script(text, jsonb, boolean) to anon, authenticated;
