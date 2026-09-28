-- M2 · role library and scripts.
select plan(24);

create temp table u as
select tests.create_user('dora', 'dm_eligible') as dm,
       tests.create_user('pat') as player,
       tests.create_user('gus', 'player', true) as guest;
grant select on u to authenticated, anon;

-- LIB-01 · M2.2: the base editions are complete.
select is((select count(*)::int from roles where is_official), 72, 'LIB-01 · M2.2: the library has all 72 base-edition characters');
select is((select count(*)::int from roles where edition = 'tb'), 22, 'LIB-01 · M2.2: Trouble Brewing: 22 characters');
select is((select count(*)::int from roles where edition = 'bmr'), 25, 'LIB-01 · M2.2: Bad Moon Rising: 25 characters');
select is((select count(*)::int from roles where edition = 'snv'), 25, 'LIB-01 · M2.2: Sects & Violets: 25 characters');
select is_empty($$ select id from roles where is_official and (name !~ '[一-鿿]' or ability !~ '[一-鿿]' or char_length(glyph) <> 1) $$,
  'LIB-01 · M2.2: every official role has a Chinese name, a Chinese ability and a one-character glyph');
select results_eq($$ select team::text as t, count(*)::int from roles where edition = 'tb' group by team order by team $$,
  $$ values ('townsfolk', 13), ('outsider', 4), ('minion', 4), ('demon', 1) $$, 'LIB-01: Trouble Brewing team counts');

-- LIB-02: nobody edits or deletes official roles through the app.
select tests.login((select dm from u));
update roles set name = '改名' where id = 'imp';
delete from roles where id = 'imp';
select tests.logout();
select is((select name from roles where id = 'imp'), '小恶魔', 'LIB-02: an official role cannot be edited or deleted, even by a DM-eligible user');

-- SCRIPT-01
select tests.login((select player from u));
select ok((select count(*) from roles) >= 72, 'SCRIPT-01: a player can browse the role library');
select tests.logout();
select is(tests.try_as((select player from u), $$ select save_script(null, '暗流涌动', null, array['imp','washerwoman']) $$), 'FORBIDDEN',
  'SCRIPT-01: a player cannot create a script');
select is(tests.try_as((select guest from u), $$ select save_script(null, '暗流涌动', null, array['imp']) $$), 'FORBIDDEN',
  'SCRIPT-01: a guest cannot create a script');

select tests.login((select dm from u));
create temp table s as select save_script(null, '暗流涌动', '官方', array['washerwoman','chef','drunk','poisoner','imp','empath','monk']) as id;
select tests.logout();
grant select on s to authenticated, anon;
select is((select count(*)::int from script_roles where script_id = (select id from s)), 7, 'SCRIPT-01: a DM-eligible user creates a script');
select tests.login((select player from u));
select is((select name from scripts where id = (select id from s)), '暗流涌动', 'SCRIPT-01: every signed-in user can read scripts');
select tests.logout();
select is(tests.try_as((select dm from u), format($$ select save_script(%L, '改名剧本', null, array['imp','chef']) $$, (select id from s))), 'allow',
  'SCRIPT-01: a DM-eligible user can edit a script');

-- SCRIPT-02
select is(tests.try_as((select dm from u), $$ select save_script(null, '   ', null, array['imp']) $$), 'SCRIPT_NAME_INVALID', 'SCRIPT-02: a script needs a name');
select is(tests.try_as((select dm from u), $$ select save_script(null, repeat('名', 31), null, array['imp']) $$), 'SCRIPT_NAME_INVALID', 'SCRIPT-02: names are at most 30 characters');
select is(tests.try_as((select dm from u), $$ select save_script(null, '空剧本', null, array[]::text[]) $$), 'SCRIPT_EMPTY', 'SCRIPT-02: a script needs at least one role');
select is(tests.try_as((select dm from u), $$ select save_script(null, '重复', null, array['imp','imp']) $$), 'SCRIPT_DUPLICATE_ROLE', 'SCRIPT-02: no role twice');
select throws_ok(format($$ insert into script_roles values (%L, 'chef', 99) $$, (select id from s)), '23505', null, 'SCRIPT-02: no role twice, even at the database level');

-- SCRIPT-03 / SCRIPT-04: custom roles
select is(tests.try_as((select player from u), $$ select create_custom_role('月光骑士', 'townsfolk', '每晚得知一件事。') $$), 'FORBIDDEN',
  'SCRIPT-03: players cannot create custom roles');
select is(tests.try_as((select dm from u), $$ select create_custom_role('', 'townsfolk', '能力') $$), 'ROLE_INVALID', 'SCRIPT-03: a custom role needs a name');
select tests.login((select dm from u));
create temp table c as select create_custom_role('月光骑士', 'townsfolk', '每个夜晚，你会得知一名玩家是否醒来过。', '骑', array['已查验']) as id;
select tests.logout();
select matches((select id from c), '^custom-[0-9a-f]{10}$', 'SCRIPT-03: a custom role gets a unique id');
select is((select row(name, team::text, is_official)::text from roles where id = (select id from c)), row('月光骑士', 'townsfolk', false)::text,
  'SCRIPT-04: the custom role joins the library, marked as custom');
select is(tests.try_as((select dm from u), format($$ select save_script(null, '自定义剧本', null, array['imp', %L]) $$, (select id from c))), 'allow',
  'SCRIPT-03 · SCRIPT-04: a script can mix library and custom roles, so other scripts can reuse it');

-- SCRIPT-06: a game keeps its own copy of the roles.
select tests.login((select dm from u));
create temp table r as select create_room(5) as code;
alter table r add column id uuid;
update r set id = (select id from rooms where code = (select code from r) and status = 'open');
create temp table g as select start_setup((select id from r), (select id from s), 'manual') as id;
select save_script((select id from s), '暗流涌动', '官方', array['imp']);
select tests.logout();
select is((select count(*)::int from game_roles where game_id = (select id from g)), 7,
  'SCRIPT-06: editing the script later does not change a game that already copied it');

select * from finish();
