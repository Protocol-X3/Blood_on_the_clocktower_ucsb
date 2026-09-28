-- M1 · rooms, seats and the DM seat.
select plan(43);

create temp table u as
select tests.create_user('admin') as admin,
       tests.create_user('dora', 'dm_eligible') as dora,
       tests.create_user('dmitri', 'dm_eligible') as dmitri,
       tests.create_user('pat') as pat,
       tests.create_user('quinn') as quinn,
       tests.create_user('gus', 'player', true) as gus,
       tests.create_user('olga') as olga;
update profiles set nickname = null where id = (select olga from u); -- olga hasn't picked a nickname
grant select on u to authenticated, anon;

-- ROOM-01: creating a room
select is(tests.try_as((select pat from u), 'select create_room()'), 'FORBIDDEN', 'ROOM-01: a player cannot create a room');
select is(tests.try_as((select gus from u), 'select create_room()'), 'FORBIDDEN', 'ROOM-01: a guest cannot create a room');
select is(tests.try_as((select admin from u), 'select create_room()'), 'allow', 'ROOM-01: the admin can create a room');

select tests.login((select dora from u));
create temp table r as select create_room(7) as code;
select tests.logout();
alter table r add column id uuid;
update r set id = (select id from rooms where code = (select code from r) and status = 'open');
grant select on r to authenticated, anon;

select is((select dm_id from rooms where id = (select id from r)), (select dora from u),
  'ROOM-01: the creator starts in the DM seat');
select is((select seat_count from rooms where id = (select id from r)), 7, 'ROOM-05: the DM sets the seat count at creation');

-- ROOM-02: room codes
select matches((select code from r), '^[A-HJKMNP-Z2-9]{4}$', 'ROOM-02: a room code is 4 characters with no look-alikes');
select is(
  (select count(*)::int from (select private.new_room_code() c from generate_series(1, 300)) s where c !~ '^[A-HJKMNP-Z2-9]{4}$'),
  0, 'ROOM-02: 300 generated codes never use 0, O, 1, I or L');
select throws_ok(
  format($$ insert into rooms (code, created_by, dm_id) values (%L, %L, %L) $$, (select code from r), (select dora from u), (select dora from u)),
  '23505', null, 'ROOM-02: two open rooms cannot share a code');

-- ROOM-04 / AUTH-04: joining
select is(tests.try_as((select olga from u), format('select join_room(%L)', (select code from r))), 'NICKNAME_REQUIRED',
  'AUTH-04: a user without a nickname cannot enter a room');
select is(tests.try_as((select pat from u), format('select join_room(%L)', lower((select code from r)))), 'allow',
  'ROOM-03 · ROOM-04: a player joins by code, ignoring letter case');
select is(tests.try_as((select pat from u), $$ select join_room('ZZZZ') $$), 'ROOM_NOT_FOUND', 'ROOM-03: an unknown code is refused');
select tests.login((select pat from u)); select join_room((select code from r)); select tests.logout();
select tests.login((select quinn from u)); select join_room((select code from r)); select tests.logout();
select tests.login((select gus from u)); select join_room((select code from r)); select tests.logout();
select tests.login((select dmitri from u)); select join_room((select code from r)); select tests.logout();
select is((select count(*)::int from room_members where room_id = (select id from r)), 5,
  'ROOM-04: signed-in users, including guests, can join an open room');

-- ROOM-06: seats
select tests.login((select pat from u)); select take_seat((select id from r), 1); select tests.logout();
select tests.login((select gus from u)); select take_seat((select id from r), 2); select tests.logout();
select is((select seat from room_members where room_id = (select id from r) and user_id = (select pat from u)), 1, 'ROOM-06: a player takes an empty seat');
select is(tests.try_as((select quinn from u), format('select take_seat(%L, 1)', (select id from r))), 'SEAT_TAKEN', 'ROOM-06: a taken seat is refused');
select is(tests.try_as((select quinn from u), format('select take_seat(%L, 8)', (select id from r))), 'SEAT_INVALID', 'ROOM-05 · ROOM-06: seats only go up to the seat count');
select tests.login((select pat from u)); select take_seat((select id from r), 3); select tests.logout();
select is((select seat from room_members where room_id = (select id from r) and user_id = (select pat from u)), 3, 'ROOM-06: a player moves to another empty seat');
select is((select count(*)::int from room_members where room_id = (select id from r) and seat = 1), 0, 'ROOM-06: moving frees the old seat');
select tests.login((select gus from u)); select leave_seat((select id from r)); select tests.logout();
select is((select seat from room_members where room_id = (select id from r) and user_id = (select gus from u)), null, 'ROOM-06: a player can leave their seat');
select throws_ok(format($$ insert into room_members (room_id, user_id, seat) values (%L, %L, 3) $$, (select id from r), (select olga from u)),
  '23505', null, 'ROOM-06: a seat holds at most one user, even at the database level');

-- ROOM-08: the DM manages seats between games
select tests.login((select dora from u)); select dm_move_player((select id from r), (select quinn from u), 5); select tests.logout();
select is((select seat from room_members where room_id = (select id from r) and user_id = (select quinn from u)), 5, 'ROOM-08: the DM moves a player to an empty seat');
select tests.login((select dora from u)); select dm_unseat((select id from r), (select quinn from u)); select tests.logout();
select is((select seat from room_members where room_id = (select id from r) and user_id = (select quinn from u)), null, 'ROOM-08: the DM unseats a player');
select tests.login((select dora from u)); select dm_kick((select id from r), (select gus from u)); select tests.logout();
select is((select count(*)::int from room_members where room_id = (select id from r) and user_id = (select gus from u)), 0, 'ROOM-08: the DM removes a player from the room');
select is(tests.try_as((select pat from u), format('select dm_kick(%L, %L)', (select id from r), (select quinn from u))), 'NOT_DM', 'ROOM-08: only the DM can remove players');

-- ROOM-12: seat count
select is(tests.try_as((select dora from u), format('select set_seat_count(%L, 5)', (select id from r))), 'allow', 'ROOM-12: the seat count can drop to the highest occupied seat');
select is(tests.try_as((select dora from u), format('select set_seat_count(%L, 4)', (select id from r))), 'SEAT_COUNT_INVALID', 'ROOM-05: at least 5 seats');
select tests.login((select pat from u)); select take_seat((select id from r), 6); select tests.logout();
select is(tests.try_as((select dora from u), format('select set_seat_count(%L, 5)', (select id from r))), 'SEAT_COUNT_TOO_LOW', 'ROOM-12: not below the highest occupied seat');

-- ROOM-09 / ROOM-10: the DM seat
select is(tests.try_as((select pat from u), format('select take_dm_seat(%L)', (select id from r))), 'FORBIDDEN', 'ROOM-09 · M1.4: a player cannot take the DM seat');
select is(tests.try_as((select dmitri from u), format('select take_dm_seat(%L)', (select id from r))), 'DM_SEAT_TAKEN', 'ROOM-09: a room has at most one DM');
select is(tests.try_as((select dora from u), format('select take_seat(%L, 1)', (select id from r))), 'IS_DM', 'ROOM-09: the DM cannot also hold a player seat');
select tests.login((select dora from u)); select leave_dm_seat((select id from r)); select tests.logout();
select is((select dm_id from rooms where id = (select id from r)), null, 'ROOM-10 · M1.4: between games the DM can leave the DM seat');
select tests.login((select dmitri from u)); select take_seat((select id from r), 2); select take_dm_seat((select id from r)); select tests.logout();
select is((select dm_id from rooms where id = (select id from r)), (select dmitri from u), 'ROOM-10: another DM-eligible member takes it');
select is((select seat from room_members where room_id = (select id from r) and user_id = (select dmitri from u)), null, 'ROOM-09: taking the DM seat gives up the player seat');

-- A game in progress (games are started in M2; here we insert one directly).
insert into games (room_id, dm_id, status) values ((select id from r), (select dmitri from u), 'in_progress');
select is(tests.try_as((select dmitri from u), format('select leave_dm_seat(%L)', (select id from r))), 'GAME_IN_PROGRESS', 'ROOM-10: the DM cannot leave mid-game');
select is(tests.try_as((select pat from u), format('select take_seat(%L, 4)', (select id from r))), 'GAME_IN_PROGRESS', 'ROOM-06: seats are fixed while a game is in progress');

-- ROOM-11 / M1.6: the admin reassigns the DM mid-game
select tests.login((select admin from u)); select join_room((select code from r)); select tests.logout();
select is(tests.try_as((select dora from u), format('select admin_assign_dm(%L, %L)', (select id from r), (select dora from u))), 'FORBIDDEN', 'ROOM-11 · M1.6: only the admin can reassign the DM');
select tests.login((select admin from u)); select admin_assign_dm((select id from r), (select dora from u)); select tests.logout();
select is((select dm_id from rooms where id = (select id from r)), (select dora from u), 'ROOM-11 · M1.6: the admin reassigns the DM seat mid-game');
select is((select dm_id from games where room_id = (select id from r) and status = 'in_progress'), (select dora from u), 'ROOM-11 · M1.6: the running game follows the new DM');

-- ROOM-15: outsiders see nothing
select tests.login((select olga from u));
select is((select count(*)::int from rooms where id = (select id from r)), 0, 'ROOM-15: a non-member cannot see the room');
select is((select count(*)::int from room_members where room_id = (select id from r)), 0, 'ROOM-15: …or its members');
select tests.logout();

-- ROOM-14: closing
select is(tests.try_as((select pat from u), format('select close_room(%L)', (select id from r))), 'FORBIDDEN', 'ROOM-14: a player cannot close the room');
select is(tests.try_as((select dora from u), format('select close_room(%L)', (select id from r))), 'allow', 'ROOM-14: the creator can close the room');
update rooms set last_activity_at = now() - interval '25 hours' where id = (select id from r);
select tests.login((select quinn from u));
select throws_ok(format('select join_room(%L)', (select code from r)), 'P0001', 'ROOM_NOT_FOUND', 'ROOM-14: a room idle for 24 hours closes and cannot be joined');
select tests.logout();

select is((select count(*)::int from cron.job where jobname = 'close-stale-rooms' and schedule = '*/10 * * * *'), 1,
  'ROOM-14: a scheduled job closes idle rooms every 10 minutes');

select * from finish();
