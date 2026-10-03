-- SCRIPT-08: a script's optional 特殊规则, extra rules that come with the script. Plain text,
-- shown on the script's page in 剧本库; nothing in a game reads it. Set in the editor, or by
-- the script-from-photo skill through import_script.

alter table public.scripts
  add column special_rules text
  check (special_rules is null or (char_length(special_rules) between 1 and 2000 and special_rules = btrim(special_rules, E' \t\r\n')));

-- save_script gains p_special_rules: line breaks become \n, surrounding blank space is trimmed,
-- and blank means none. The old four-argument version is dropped rather than overloaded, so
-- PostgREST never has two candidates to choose between.
drop function public.save_script(uuid, text, text, text[]);

-- SCRIPT-01 / SCRIPT-02 / SCRIPT-08: DM-eligible users create (p_script null) or replace a script.
create function public.save_script(p_script uuid, p_name text, p_author text, p_roles text[], p_special_rules text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_name text := btrim(p_name);
  v_author text := nullif(btrim(coalesce(p_author, '')), '');
  v_rules text := nullif(btrim(replace(coalesce(p_special_rules, ''), E'\r\n', E'\n'), E' \t\r\n'), '');
  v_script uuid := p_script;
begin
  if not private.can_dm(uid) then
    perform private.fail('FORBIDDEN');
  end if;
  if v_name is null or char_length(v_name) not between 1 and 30 or (v_author is not null and char_length(v_author) > 30) then
    perform private.fail('SCRIPT_NAME_INVALID');
  end if;
  if v_rules is not null and char_length(v_rules) > 2000 then
    perform private.fail('SCRIPT_RULES_TOO_LONG');
  end if;
  if p_roles is null or cardinality(p_roles) = 0 then
    perform private.fail('SCRIPT_EMPTY');
  end if;
  if (select count(distinct r) from unnest(p_roles) r) <> cardinality(p_roles) then
    perform private.fail('SCRIPT_DUPLICATE_ROLE');
  end if;
  if exists (select 1 from unnest(p_roles) r where not exists (select 1 from public.roles where id = r)) then
    perform private.fail('ROLE_NOT_FOUND');
  end if;

  if v_script is null then
    insert into public.scripts (name, author, special_rules, created_by) values (v_name, v_author, v_rules, uid) returning id into v_script;
  else
    update public.scripts set name = v_name, author = v_author, special_rules = v_rules, updated_at = now() where id = v_script;
    if not found then
      perform private.fail('SCRIPT_NOT_FOUND');
    end if;
    delete from public.script_roles where script_id = v_script;
  end if;
  insert into public.script_roles (script_id, role_id, position)
  select v_script, r, ordinality from unnest(p_roles) with ordinality as t(r, ordinality);
  return v_script;
end $$;

revoke execute on function public.save_script(uuid, text, text, text[], text) from public, anon;
grant execute on function public.save_script(uuid, text, text, text[], text) to authenticated;

-- import_script (SCRIPT-07) passes the spec's "special_rules" (a string, or null/absent for
-- none) to save_script, and reads it back in the result. Otherwise unchanged. p_spec:
--   {"name": "钟声来了", "author": "Bruce C." | null, "special_rules": "…" | null, "replace": false,
--    "roles": ["clockmaker", {"custom": {"name": "卡牌大师", "team": "townsfolk", "ability": "…", "glyph": "牌", "reminders": []}}, …]}
-- Returns {"script", "replaced", "dry_run", "special_rules", "roles": [{position, id, name, team, edition, is_official, created}]}.
create or replace function public.import_script(p_token text, p_spec jsonb, p_dry_run boolean default false) returns jsonb
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
     or jsonb_typeof(coalesce(p_spec -> 'author', 'null')) not in ('string', 'null')
     or jsonb_typeof(coalesce(p_spec -> 'special_rules', 'null')) not in ('string', 'null') then
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
    v_script := public.save_script(v_existing, v_name, p_spec ->> 'author', v_ids, p_spec ->> 'special_rules');

    -- Read it back: the rules as stored, and every role, in order, with its team and collection.
    select jsonb_build_object(
      'script', v_script,
      'replaced', v_existing is not null,
      'dry_run', p_dry_run,
      'special_rules', (select s.special_rules from public.scripts s where s.id = v_script),
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
