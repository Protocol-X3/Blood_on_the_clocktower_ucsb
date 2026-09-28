-- M5 · who sees a past game (HIST-02), stats for everyone (HIST-04), guests (STATS-06) and account deletion (HIST-06).
select * from no_plan();

create temp table u as
select tests.create_user('admin') as admin,
       tests.create_user('dora', 'dm_eligible') as dm,
       tests.create_user('p1') as p1, tests.create_user('p2') as p2, tests.create_user('p3') as p3,
       tests.create_user('p4') as p4, tests.create_user('gus', 'player', true) as guest,
       tests.create_user('olga') as onlooker, tests.create_user('sam') as stranger;
grant select on u to authenticated, anon;
-- The configured admin email (helpers) makes 'admin' the admin.
update profiles set permission = 'admin' where id = (select admin from u);

insert into scripts (id, name, created_by) values ('00000000-0000-0000-0000-00000000007b', '暗流涌动', (select dm from u));
insert into script_roles (script_id, role_id, position)
select '00000000-0000-0000-0000-00000000007b', id, row_number() over (order by id) from roles where edition = 'tb';

select tests.login((select dm from u));
create temp table r as select create_room(5) as code;
select tests.logout();
alter table r add column id uuid;
update r set id = (select id from rooms where code = (select code from r) and status = 'open');
grant select on r to authenticated, anon;
-- Seat 5 is a guest.
insert into room_members (room_id, user_id, seat)
select (select id from r), x.uid, x.seat from (values
  ((select p1 from u), 1), ((select p2 from u), 2), ((select p3 from u), 3), ((select p4 from u), 4), ((select guest from u), 5),
  ((select onlooker from u), null)) as x(uid, seat);

create temp table g (id uuid, g2 uuid);
grant all on g to authenticated, anon;
insert into g values (null, null);
select tests.login((select dm from u));
update g set id = start_setup((select id from r), '00000000-0000-0000-0000-00000000007b', 'manual');
select set_composition((select id from g), '[{"role":"washerwoman"},{"role":"chef"},{"role":"drunk","shown":"empath"},{"role":"poisoner"},{"role":"imp"}]');
select assign_seat((select id from g), 1, 'washerwoman');
select assign_seat((select id from g), 2, 'chef');
select assign_seat((select id from g), 3, 'drunk');
select assign_seat((select id from g), 4, 'poisoner');
select assign_seat((select id from g), 5, 'imp');
select start_game((select id from g));
select advance_phase((select id from g));
select post_board((select id from g), '天亮了');
select set_alignment((select id from g), 2, 'evil');
select tests.logout();

-- While it runs, room members (onlookers too) follow the public game.
select tests.login((select onlooker from u));
select is((select count(*)::int from game_seats where game_id = (select id from g)), 5, 'HIST-02: while the game runs, the room sees its seats');
select tests.logout();

select tests.login((select dm from u));
select end_game((select id from g), 'evil');
select tests.logout();

-- ───────────── HIST-02 ─────────────
create function pg_temp.visible(p_user uuid) returns text language plpgsql as $$
declare
  res text;
begin
  perform tests.login(p_user);
  select concat_ws(',',
    (select count(*) from public.games where id = (select id from g)),
    (select count(*) from public.game_seats where game_id = (select id from g)),
    (select count(*) from public.seat_roles where game_id = (select id from g)),
    (select count(*) from public.board_posts where game_id = (select id from g)),
    (select count(*) from public.game_roles where game_id = (select id from g)))
  into res;
  perform tests.logout();
  return res;
end $$;
select is(pg_temp.visible((select p1 from u)), '1,5,5,1,22', 'HIST-02 · M5.3: a player of the game reads all of it');
select is(pg_temp.visible((select guest from u)), '1,5,5,1,22', 'HIST-02 · M5.3: …a guest player too');
select is(pg_temp.visible((select dm from u)), '1,5,5,1,22', 'HIST-02 · M5.3: …and its DM');
select is(pg_temp.visible((select admin from u)), '1,5,5,1,22', 'HIST-02 · M5.3: the admin reads any past game');
select is(pg_temp.visible((select onlooker from u)), '0,0,0,0,0', 'HIST-02 · M5.3: an onlooker who was in the room but not in the game reads nothing');
select is(pg_temp.visible((select stranger from u)), '0,0,0,0,0', 'HIST-02 · M5.3: nor does anyone else');

-- The players leave the room; the game is still theirs.
delete from room_members where room_id = (select id from r) and user_id = (select p1 from u);
select is(pg_temp.visible((select p1 from u)), '1,5,5,1,22', 'HIST-02 · M5.3: participants keep reading a past game after leaving the room');

-- ───────────── HIST-01 / HIST-04 ─────────────
select tests.login((select p2 from u));
select is(
  (select array_agg(script_name || ':' || role_name || ':' || final_alignment || ':' || winner || ':' || as_dm) from profile_history((select p2 from u))),
  array['暗流涌动:厨师:evil:evil:false'],
  'HIST-01: a player''s history lists the game with its script, their role, final alignment and result');
select tests.logout();
select tests.login((select stranger from u));
select is((select count(*)::int from profile_history((select p2 from u))), 0, 'HIST-02: others don''t see the games in someone''s history');
select is(
  (select array_agg(starting_role || ':' || final_alignment || ':' || winner || ':' || as_dm) from profile_stat_rows((select p2 from u))),
  array['chef:evil:evil:false'],
  'HIST-04: every signed-in user sees anyone''s stats (numbers only, no game)');
select is((select count(*)::int from profile_stat_rows((select dm from u)) where as_dm), 1, 'STATS-05: games run as DM count for the DM');
select tests.logout();
select tests.login((select admin from u));
select is((select count(*)::int from profile_history((select p2 from u))), 1, 'HIST-02: the admin sees anyone''s history');
select tests.logout();
select is(tests.try_as(null, format('select * from profile_stat_rows(%L)', (select p2 from u))), 'permission denied for function profile_stat_rows', 'HIST-04: signed-out visitors see no stats');

-- ───────────── STATS-06 ─────────────
select tests.login((select p1 from u));
select is((select count(*)::int from profile_stat_rows((select guest from u))), 0, 'STATS-06: guests have no stats');
select is((select count(*)::int from profile_stat_rows((select p3 from u))), 1, 'STATS-06: a game with a guest still counts for the others');
select tests.logout();
-- STATS-07: after upgrading, the guest's earlier games count.
update auth.users set is_anonymous = false, email = 'gus@test.botc' where id = (select guest from u);
select tests.login((select p1 from u));
select is((select count(*)::int from profile_stat_rows((select guest from u))), 1, 'STATS-07: once upgraded, the guest''s earlier games count');
select tests.logout();

-- ───────────── HIST-06 ─────────────
select is(tests.try_as((select dm from u), format('select admin_delete_user(%L)', (select p4 from u))), 'FORBIDDEN', 'HIST-06: only the admin deletes accounts');
select is(tests.try_as((select admin from u), format('select admin_delete_user(%L)', (select admin from u))), 'CANNOT_DELETE_SELF', 'HIST-06: the admin cannot delete their own account');
-- A second, running game in the room: its seated players can't be deleted yet.
-- Setup needs every seat filled, so seat 1's player (who left above) comes back.
insert into room_members (room_id, user_id, seat) values ((select id from r), (select p1 from u), 1);
select tests.login((select dm from u));
update g set g2 = start_setup((select id from r), '00000000-0000-0000-0000-00000000007b', 'draw');
select tests.logout();
select is(tests.try_as((select admin from u), format('select admin_delete_user(%L)', (select p3 from u))), 'USER_IN_GAME', 'HIST-06: not while they sit in a game in progress');
select tests.login((select dm from u));
select cancel_setup((select g2 from g));
select tests.logout();
select tests.login((select admin from u));
select admin_delete_user((select p4 from u));
select tests.logout();
select is((select count(*)::int from auth.users where id = (select p4 from u)), 0, 'HIST-06: the sign-in identity and email are removed');
select is((select count(*)::int from profiles where id = (select p4 from u)), 0, 'HIST-06: …and the nickname');
select is(
  (select array[coalesce(user_id::text, 'none'), (select actual_role_id from seat_roles where game_id = (select id from g) and seat = 4)] from game_seats where game_id = (select id from g) and seat = 4),
  array['none', 'poisoner'],
  'HIST-06: the game record stays, with no one in the seat (shown as 已删除用户)');

select * from finish();
