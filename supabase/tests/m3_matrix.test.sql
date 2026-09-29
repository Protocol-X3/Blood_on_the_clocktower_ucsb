-- M3 permission matrix: every M3 action × every kind of user × five game states.
-- Each call runs as that user and is rolled back, so they don't affect each other.
select plan(630);

create temp table u as
select tests.create_user('admin') as admin,
       tests.create_user('dora', 'dm_eligible') as dm,
       tests.create_user('dmitri', 'dm_eligible') as dme,
       tests.create_user('pat') as player,
       tests.create_user('gus', 'player', true) as guest,
       tests.create_user('olga') as outsider,
       tests.create_user('f3') as f3, tests.create_user('f4') as f4, tests.create_user('f5') as f5;

insert into scripts (id, name, created_by) values ('00000000-0000-0000-0000-00000000007b', '暗流涌动', (select dm from u));
insert into script_roles (script_id, role_id, position)
select '00000000-0000-0000-0000-00000000007b', id, row_number() over (order by id) from roles where edition = 'tb';

select tests.login((select dm from u));
create temp table r as select create_room(5) as code;
select tests.logout();
alter table r add column id uuid;
update r set id = (select id from rooms where code = (select code from r) and status = 'open');
insert into room_members (room_id, user_id, seat)
select (select id from r), x.uid, x.seat from (values
  ((select admin from u), null::int), ((select dme from u), null), ((select player from u), 1), ((select guest from u), 2),
  ((select f3 from u), 3), ((select f4 from u), 4), ((select f5 from u), 5)) as x(uid, seat);

create temp table state (game uuid, nom uuid, post uuid);
insert into state values (null, '00000000-0000-0000-0000-000000000000', null);
grant all on state to authenticated, anon;

-- A running game; seat 4 is dead; the DM has posted once.
select tests.login((select dm from u));
update state set game = start_setup((select id from r), '00000000-0000-0000-0000-00000000007b', 'manual');
select set_composition((select game from state), '[{"role":"washerwoman"},{"role":"chef"},{"role":"drunk","shown":"empath"},{"role":"poisoner"},{"role":"imp"}]');
select assign_seat((select game from state), 1, 'washerwoman');
select assign_seat((select game from state), 2, 'chef');
select assign_seat((select game from state), 3, 'drunk');
select assign_seat((select game from state), 4, 'poisoner');
select assign_seat((select game from state), 5, 'imp');
select start_game((select game from state));
select kill_seat((select game from state), 4, 'night');
update state set post = post_board((select game from state), '说书人公告');
select tests.logout();

create temp table actors (ord int, name text, uid uuid);
insert into actors values
  (1, 'admin', (select admin from u)), (2, 'dm', (select dm from u)), (3, 'dm-eligible', (select dme from u)),
  (4, 'player', (select player from u)), (5, 'guest', (select guest from u)), (6, 'outsider', (select outsider from u)),
  (7, 'signed-out', null);

-- %g = the game, %n = the current nomination, %p = the DM's post.
create temp table calls (ord int, name text, stmt text, night text[], day text[], open text[], voting text[], ended text[]);
insert into calls values
  (1, 'advance_phase', 'select advance_phase(%g)', '{dm}', '{dm}', '{}', '{}', '{}'),
  (2, 'kill_seat', $$select kill_seat(%g, 3, 'night')$$, '{dm}', '{dm}', '{dm}', '{dm}', '{}'),
  (3, 'revive_seat', 'select revive_seat(%g, 4)', '{dm}', '{dm}', '{dm}', '{dm}', '{}'),
  (4, 'set_ghost_vote', 'select set_ghost_vote(%g, 4, true)', '{dm}', '{dm}', '{dm}', '{dm}', '{}'),
  (5, 'open_nomination', 'select open_nomination(%g, 3, 5)', '{}', '{dm}', '{}', '{}', '{}'),
  (6, 'cancel_nomination', 'select cancel_nomination(%n)', '{}', '{}', '{dm}', '{}', '{}'),
  (7, 'set_hand (raise)', 'select set_hand(%n, true)', '{}', '{}', '{player,guest}', '{guest}', '{}'),
  (8, 'start_vote', 'select start_vote(%n)', '{}', '{}', '{dm}', '{}', '{}'),
  (9, 'advance_vote', 'select advance_vote(%n, 1)', '{}', '{}', '{}', '{dm}', '{}'),
  (10, 'set_vote_paused', 'select set_vote_paused(%n, true)', '{}', '{}', '{}', '{dm}', '{}'),
  (11, 'set_vote_speed', 'select set_vote_speed(%g, 1000)', '{dm}', '{dm}', '{dm}', '{dm}', '{}'),
  (12, 'correct_vote', 'select correct_vote(%n, 1, true)', '{}', '{}', '{}', '{dm}', '{}'),
  (13, 'conclude_day', 'select conclude_day(%g, false)', '{}', '{dm}', '{}', '{}', '{}'),
  (14, 'post_board', $$select post_board(%g, '大家好')$$, '{dm,player,guest}', '{dm,player,guest}', '{dm,player,guest}', '{dm,player,guest}', '{}'),
  (15, 'delete_post (the DM''s)', 'select delete_post(%p)', '{dm}', '{dm}', '{dm}', '{dm}', '{}'),
  (16, 'end_game', $$select end_game(%g, 'good')$$, '{dm}', '{dm}', '{dm}', '{dm}', '{}'),
  (17, 'close_vote (not yet counted)', 'select close_vote(%n)', '{}', '{}', '{}', '{}', '{}'),
  (18, 'discard_game', 'select discard_game(%g)', '{dm}', '{dm}', '{dm}', '{dm}', '{}');

create temp table outcomes (state text, state_ord int, call_ord int, actor_ord int, call text, actor text, expected text, actual text);

create function pg_temp.bind(p_stmt text) returns text language sql as $$
  select replace(replace(replace(p_stmt,
    '%g', quote_literal((select game from state))),
    '%n', quote_literal((select nom from state))),
    '%p', quote_literal((select post from state)));
$$;

create function pg_temp.record(p_state text, p_ord int) returns void language sql as $$
  insert into outcomes
  select p_state, p_ord, c.ord, a.ord, c.name, a.name,
         case when a.name = any (case p_state when 'night' then c.night when 'day' then c.day when 'nomination open' then c.open
                                               when 'voting' then c.voting else c.ended end) then 'allow' else 'deny' end,
         tests.try_as(a.uid, pg_temp.bind(c.stmt))
  from calls c cross join actors a;
$$;

select pg_temp.record('night', 1);

select tests.login((select dm from u));
select advance_phase((select game from state));
select tests.logout();
select pg_temp.record('day', 2);

-- Nominee 5: the circle starts at seat 1.
select tests.login((select dm from u));
update state set nom = open_nomination((select game from state), 1, 5);
select tests.logout();
select pg_temp.record('nomination open', 3);

-- The hand has passed seat 1 (the player); seat 2 (the guest) is next.
select tests.login((select dm from u));
select start_vote((select nom from state));
select advance_vote((select nom from state), 0);
select tests.logout();
select pg_temp.record('voting', 4);

select tests.login((select dm from u));
select end_game((select game from state), 'evil');
select tests.logout();
select pg_temp.record('ended', 5);

select is(
  case when actual = 'allow' then 'allow' else 'deny' end,
  expected,
  format('END-05 · M3 permission matrix: %s by %s (%s) → %s%s', call, actor, state, expected,
         case when actual <> 'allow' and expected = 'deny' then ' [' || actual || ']' else '' end)
)
from outcomes
order by state_ord, call_ord, actor_ord;

select * from finish();
