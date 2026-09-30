-- SCRIPT-07: the script-from-photo tools' import token (M6 over HTTPS).
select * from no_plan();

-- The token the tests use, and the hash the database keeps.
create temp table t as select repeat('a1b2c3d4', 8) as token, repeat('z', 64) as wrong;
grant select on t to authenticated, anon;
insert into private.app_config (key, value)
values ('script_import_token_sha256', encode(sha256(convert_to((select token from t), 'UTF8')), 'hex'))
on conflict (key) do update set value = excluded.value;

create function pg_temp.spec(p_name text, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('name', p_name, 'author', 'Bruce C.', 'roles', jsonb_build_array(
    'washerwoman', 'imp', jsonb_build_object('custom', jsonb_build_object('name', '卡牌测试师', 'team', 'townsfolk', 'ability', '每个夜晚，你会得知一张牌。', 'glyph', '牌', 'reminders', '["已看牌"]'::jsonb)))) || p_extra;
$$;

-- No admin has signed in yet.
select is(tests.try_as(null, format($$select import_script(%L, pg_temp.spec('钟声测试'))$$, (select token from t))), 'ADMIN_NOT_SIGNED_IN',
  'SCRIPT-07: the import needs an admin account to own the script');
create temp table u as select tests.create_user('admin') as admin, tests.create_user('pat') as player;
grant select on u to authenticated, anon;

-- The token is the only credential.
select is(tests.try_as(null, format($$select import_script(%L, pg_temp.spec('钟声测试'))$$, (select wrong from t))), 'IMPORT_TOKEN_INVALID', 'SCRIPT-07: a wrong token is refused');
select is(tests.try_as(null, $$select import_script(null, pg_temp.spec('钟声测试'))$$), 'IMPORT_TOKEN_INVALID', 'SCRIPT-07: …and no token');
select is(tests.try_as((select player from u), format($$select import_script(%L, pg_temp.spec('钟声测试'))$$, (select wrong from t))), 'IMPORT_TOKEN_INVALID',
  'SCRIPT-07: signing in is no substitute for the token');
select is(tests.try_as(null, format('select count(*) from script_import_library(%L)', (select wrong from t))), 'IMPORT_TOKEN_INVALID', 'SCRIPT-07: the library read needs the token too');
select is(tests.try_as(null, 'select private.script_import_admin(''x'')'), 'permission denied for schema private', 'SCRIPT-07: the token check itself is not callable');

-- With it: the library, over the same HTTPS path the app uses (anon role + publishable key).
select tests.login_anon();
create temp table lib as select * from script_import_library((select token from t));
select tests.logout();
select is((select count(*)::int from lib), (select count(*)::int from roles), 'SCRIPT-07: with the token, the tools read the whole role library');
select is((select name || ':' || team || ':' || edition from lib where id = 'clockmaker'), (select name || ':' || team::text || ':' || edition from roles where id = 'clockmaker'),
  'SCRIPT-07: …with each role''s name, team and collection');

-- A dry run builds everything and keeps nothing.
select tests.login_anon();
create temp table dry as select import_script((select token from t), pg_temp.spec('钟声测试'), true) as r;
create temp table claims_after as select current_setting('request.jwt.claims', true) as c;
select tests.logout();
select is((select r ->> 'dry_run' from dry), 'true', 'SCRIPT-07: a dry run reports the script it would save');
select is((select jsonb_array_length(r -> 'roles') from dry), 3, 'SCRIPT-07: …with every role');
select is((select count(*)::int from scripts where name = '钟声测试') + (select count(*)::int from roles where name = '卡牌测试师'), 0, 'SCRIPT-07: …and rolls it all back');
select is((select c from claims_after), '{"role":"anon"}', 'SCRIPT-07: the caller''s identity is restored afterwards');

-- The real import: owned by the admin, custom role in 自制角色, in order.
select tests.login_anon();
create temp table saved as select import_script((select token from t), pg_temp.spec('钟声测试')) as r;
select tests.logout();
select is((select created_by from scripts where name = '钟声测试'), (select admin from u), 'SCRIPT-07: the script is saved as the admin');
select is((select author from scripts where name = '钟声测试'), 'Bruce C.', 'SCRIPT-07: …with its author');
select is((select array_agg(r2.name order by sr.position) from script_roles sr join roles r2 on r2.id = sr.role_id join scripts s on s.id = sr.script_id where s.name = '钟声测试'),
  array['洗衣妇', '小恶魔', '卡牌测试师'], 'SCRIPT-07: …with its roles in order');
select is((select edition || ':' || is_official || ':' || reminders[1] from roles where name = '卡牌测试师'), 'homebrew:false:已看牌', 'SCRIPT-04 · SCRIPT-07: the new role joins 自制角色');
select is((select (e ->> 'created')::boolean from saved, jsonb_array_elements(r -> 'roles') e where e ->> 'name' = '卡牌测试师'), true, 'SCRIPT-07: the result marks the role it created');
select is((select r ->> 'replaced' from saved), 'false', 'SCRIPT-07: …and that it was a new script');

-- The owner's rules: an existing name needs "replace"; a role name is never created twice.
select is(tests.try_as(null, format($$select import_script(%L, pg_temp.spec('钟声测试'))$$, (select token from t))), 'SCRIPT_NAME_TAKEN', 'SCRIPT-07: an existing script name is refused');
select is(tests.try_as(null, format($$select import_script(%L, pg_temp.spec('没有这个剧本', '{"replace": true}'))$$, (select token from t))), 'SCRIPT_NOT_FOUND', 'SCRIPT-07: "replace" needs a script to replace');
select is(tests.try_as(null, format($$select import_script(%L, pg_temp.spec('钟声测试', '{"replace": true}'))$$, (select token from t))), 'ROLE_NAME_TAKEN',
  'SCRIPT-07: a custom role whose name exists is refused (reuse its id instead)');
create temp table card as select id from roles where name = '卡牌测试师';
grant select on card to anon;
select tests.login_anon();
select import_script((select token from t), jsonb_build_object('name', '钟声测试', 'replace', true, 'author', null,
  'roles', jsonb_build_array('chef', (select id from card))));
select tests.logout();
select is((select array_agg(r2.name order by sr.position) from script_roles sr join roles r2 on r2.id = sr.role_id join scripts s on s.id = sr.script_id where s.name = '钟声测试'),
  array['厨师', '卡牌测试师'], 'SCRIPT-07: "replace" overwrites the script, reusing the 自制角色 by its id');
select is((select count(*)::int from scripts where name = '钟声测试'), 1, 'SCRIPT-07: …without a second copy');

-- The editor's own checks still apply, and a bad spec changes nothing.
select is(tests.try_as(null, format($$select import_script(%L, '{"name": "空剧本", "roles": []}')$$, (select token from t))), 'SCRIPT_EMPTY', 'SCRIPT-02 · SCRIPT-07: the editor''s checks apply');
select is(tests.try_as(null, format($$select import_script(%L, '{"name": "坏", "roles": ["no_such_role"]}')$$, (select token from t))), 'ROLE_NOT_FOUND', 'SCRIPT-07: unknown role ids are refused');
select is(tests.try_as(null, format($$select import_script(%L, '{"name": "坏", "roles": [{"custom": {"name": "怪", "team": "dragon", "ability": "x"}}]}')$$, (select token from t))), 'IMPORT_SPEC_INVALID',
  'SCRIPT-07: a malformed custom role is refused');
select is(tests.try_as(null, format($$select import_script(%L, '{"roles": ["chef"]}')$$, (select token from t))), 'IMPORT_SPEC_INVALID', 'SCRIPT-07: a spec needs a name');
select is((select count(*)::int from scripts where name in ('空剧本', '坏')), 0, 'SCRIPT-07: refused imports leave nothing behind');

-- Replacing the stored hash revokes the old token.
update private.app_config set value = encode(sha256(convert_to('another-token-another-token-0123', 'UTF8')), 'hex') where key = 'script_import_token_sha256';
select is(tests.try_as(null, format('select count(*) from script_import_library(%L)', (select token from t))), 'IMPORT_TOKEN_INVALID', 'SCRIPT-07: a new token revokes the old one');

select * from finish();
