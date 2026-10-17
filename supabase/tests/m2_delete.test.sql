-- SCRIPT-09 / SCRIPT-10: deleting scripts and 自制角色.
select * from no_plan();

create temp table u as
select tests.create_user('dora', 'dm_eligible') as dm,
       tests.create_user('pat') as player,
       tests.create_user('gus', 'player', true) as guest;
grant select on u to authenticated, anon;

select tests.login((select dm from u));
create temp table c as select create_custom_role('删除测试师', 'townsfolk', '每个夜晚，你会得知一件事。') as used, create_custom_role('无用测试师', 'outsider', '你没有能力。') as unused;
create temp table s as select save_script(null, '将删剧本', null, array['imp', 'washerwoman', (select used from c)]) as gone,
                              save_script(null, '在玩剧本', null, array['imp', 'chef']) as playing;
select tests.logout();
grant select on c, s to authenticated, anon;

-- A game played to the end with 将删剧本, and one still being set up with 在玩剧本.
create temp table g as select gen_random_uuid() as ended, gen_random_uuid() as setup, gen_random_uuid() as room1, gen_random_uuid() as room2;
insert into public.rooms (id, code, created_by, dm_id, status, closed_at) select room1, 'QQQ5', dm, dm, 'closed', now() from g, u;
insert into public.rooms (id, code, created_by, dm_id) select room2, 'QQQ6', dm, dm from g, u;
insert into public.games (id, room_id, dm_id, status, script_id, ended_at, winner) select ended, room1, dm, 'ended', (select gone from s), now(), 'good' from g, u;
insert into public.games (id, room_id, dm_id, status, script_id) select setup, room2, dm, 'setup', (select playing from s) from g, u;
insert into public.game_roles (game_id, role_id, name, team, ability, glyph)
select (select ended from g), r.id, r.name, r.team, r.ability, coalesce(r.glyph, left(r.name, 1)) from roles r where r.id = (select used from c);

-- SCRIPT-09: deleting a script.
select is(tests.try_as((select player from u), format('select delete_script(%L)', (select gone from s))), 'FORBIDDEN', 'SCRIPT-09: a player cannot delete a script');
select is(tests.try_as((select guest from u), format('select delete_script(%L)', (select gone from s))), 'FORBIDDEN', 'SCRIPT-09: nor can a guest');
select is(tests.try_as(null, format('select delete_script(%L)', (select gone from s))), 'permission denied for function delete_script', 'SCRIPT-09: nor a signed-out visitor');
select is(tests.try_as((select dm from u), format('select delete_script(%L)', (select playing from s))), 'SCRIPT_IN_USE', 'SCRIPT-09: a script in a game being set up or played cannot be deleted');
select is(tests.try_as((select dm from u), format('select delete_script(%L)', gen_random_uuid())), 'SCRIPT_NOT_FOUND', 'SCRIPT-09: deleting a script that does not exist is refused');

-- SCRIPT-10: a role still in a script is refused, before and after.
select is(tests.try_as((select dm from u), format('select delete_custom_role(%L)', (select used from c))), 'ROLE_IN_USE', 'SCRIPT-10: a 自制角色 still in a script cannot be deleted');

select tests.login((select dm from u));
select delete_script((select gone from s));
select tests.logout();
select is((select count(*)::int from scripts where id = (select gone from s)), 0, 'SCRIPT-09: a DM-eligible user deletes a script');
select is((select count(*)::int from script_roles where script_id = (select gone from s)), 0, 'SCRIPT-09: …and its role list goes with it');
select is((select count(*)::int from roles where id = (select used from c)), 1, 'SCRIPT-09: …but its 自制角色 stay in the library');
select is((select script_id::text || '|' || script_name from games where id = (select ended from g)), null, 'SCRIPT-09: the game no longer points at the script');
select is((select script_name from games where id = (select ended from g)), '将删剧本', 'SCRIPT-09: …and keeps its name');
select is((select count(*)::int from game_roles where game_id = (select ended from g)), 1, 'SCRIPT-06 · SCRIPT-09: the game keeps its copy of the roles');
grant select on g to authenticated;
select tests.login((select dm from u));
select is((select script_name from profile_history((select dm from u)) where game_id = (select ended from g)), '将删剧本', 'HIST-01 · SCRIPT-09: the history still shows the script''s name');
select tests.logout();

-- SCRIPT-10: deleting 自制角色.
select is(tests.try_as((select player from u), format('select delete_custom_role(%L)', (select unused from c))), 'FORBIDDEN', 'SCRIPT-10: a player cannot delete a 自制角色');
select is(tests.try_as((select guest from u), format('select delete_custom_role(%L)', (select unused from c))), 'FORBIDDEN', 'SCRIPT-10: nor can a guest');
select is(tests.try_as((select dm from u), $$select delete_custom_role('imp')$$), 'ROLE_OFFICIAL', 'SCRIPT-10 · LIB-02: official roles are never deleted');
select is(tests.try_as((select dm from u), $$select delete_custom_role('custom-nothere00')$$), 'ROLE_NOT_FOUND', 'SCRIPT-10: deleting a role that does not exist is refused');
select tests.login((select dm from u));
select delete_custom_role((select used from c));
select delete_custom_role((select unused from c));
select tests.logout();
select is((select count(*)::int from roles where id in ((select used from c), (select unused from c))), 0,
  'SCRIPT-10: once no script uses it, a DM-eligible user deletes a 自制角色');
select is((select name from game_roles where game_id = (select ended from g) and role_id = (select used from c)), '删除测试师',
  'SCRIPT-06 · SCRIPT-10: a game played with the role still shows it');

select * from finish();
