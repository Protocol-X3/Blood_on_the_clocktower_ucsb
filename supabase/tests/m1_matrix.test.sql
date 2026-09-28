-- M1.2 · permission matrix: every M1 action × every kind of user × lobby / game running.
-- Each call runs as that user and is rolled back, so they don't affect each other.
select plan(210);

create temp table u as
select tests.create_user('admin') as admin,
       tests.create_user('dora', 'dm_eligible') as dm,
       tests.create_user('dmitri', 'dm_eligible') as dme,
       tests.create_user('pat') as player,
       tests.create_user('gus', 'player', true) as guest,
       tests.create_user('olga') as outsider;

select tests.login((select dm from u));
create temp table r as select create_room(8) as code;
select tests.logout();
alter table r add column id uuid;
update r set id = (select id from rooms where code = (select code from r) and status = 'open');

-- Members: admin and dm-eligible unseated, player in seat 1, guest in seat 2.
insert into room_members (room_id, user_id, seat)
select (select id from r), x.uid, x.seat
from (values ((select admin from u), null::int), ((select dme from u), null), ((select player from u), 1), ((select guest from u), 2)) as x(uid, seat);

create temp table actors (ord int, name text, uid uuid);
insert into actors values
  (1, 'admin', (select admin from u)), (2, 'dm', (select dm from u)), (3, 'dm-eligible', (select dme from u)),
  (4, 'player', (select player from u)), (5, 'guest', (select guest from u)), (6, 'outsider', (select outsider from u)),
  (7, 'signed-out', null);

-- Who may call what, in the lobby and while a game is running.
create temp table calls (ord int, name text, stmt text, lobby text[], game text[]);
insert into calls values
  (1, 'set_nickname', $$select set_nickname('矩阵测试')$$,
     '{admin,dm,dm-eligible,player,guest,outsider}', '{admin,dm,dm-eligible,player,guest,outsider}'),
  (2, 'set_permission', format('select set_permission(%L, %L)', (select outsider from u), 'dm_eligible'), '{admin}', '{admin}'),
  (3, 'create_room', 'select create_room()', '{admin,dm,dm-eligible}', '{admin,dm,dm-eligible}'),
  (4, 'join_room', format('select join_room(%L)', (select code from r)),
     '{admin,dm,dm-eligible,player,guest,outsider}', '{admin,dm,dm-eligible,player,guest,outsider}'),
  (5, 'take_seat', format('select take_seat(%L, 7)', (select id from r)), '{admin,dm-eligible,player,guest}', '{}'),
  (6, 'leave_seat', format('select leave_seat(%L)', (select id from r)), '{admin,dm,dm-eligible,player,guest}', '{}'),
  (7, 'set_seat_count', format('select set_seat_count(%L, 12)', (select id from r)), '{dm}', '{}'),
  (8, 'dm_move_player', format('select dm_move_player(%L, %L, 7)', (select id from r), (select player from u)), '{dm}', '{}'),
  (9, 'dm_unseat', format('select dm_unseat(%L, %L)', (select id from r), (select player from u)), '{dm}', '{}'),
  (10, 'dm_kick', format('select dm_kick(%L, %L)', (select id from r), (select guest from u)), '{dm}', '{}'),
  (11, 'take_dm_seat (seat occupied)', format('select take_dm_seat(%L)', (select id from r)), '{}', '{}'),
  (12, 'leave_dm_seat', format('select leave_dm_seat(%L)', (select id from r)), '{dm}', '{}'),
  (13, 'admin_assign_dm', format('select admin_assign_dm(%L, %L)', (select id from r), (select dme from u)), '{admin}', '{admin}'),
  (14, 'close_room', format('select close_room(%L)', (select id from r)), '{admin,dm}', '{admin,dm}'),
  (15, 'leave_room', format('select leave_room(%L)', (select id from r)), '{admin,dm,dm-eligible,player,guest}', '{admin,dm-eligible}');

create temp table outcomes (state text, call_ord int, actor_ord int, call text, actor text, expected text, actual text);

insert into outcomes
select 'lobby', c.ord, a.ord, c.name, a.name,
       case when a.name = any (c.lobby) then 'allow' else 'deny' end,
       tests.try_as(a.uid, c.stmt)
from calls c cross join actors a;

insert into games (room_id, dm_id, status) values ((select id from r), (select dm from u), 'in_progress');

insert into outcomes
select 'game', c.ord, a.ord, c.name, a.name,
       case when a.name = any (c.game) then 'allow' else 'deny' end,
       tests.try_as(a.uid, c.stmt)
from calls c cross join actors a;

select is(
  case when actual = 'allow' then 'allow' else 'deny' end,
  expected,
  format('M1.2 permission matrix: %s by %s (%s) → %s%s', call, actor, state, expected,
         case when actual <> 'allow' and expected = 'deny' then ' [' || actual || ']' else '' end)
)
from outcomes
order by state desc, call_ord, actor_ord;

select * from finish();
