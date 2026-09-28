-- M4 permission matrix: every grimoire action × every kind of user × running / ended.
-- Each call runs as that user and is rolled back, so they don't affect each other.
select plan(98);

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

create temp table state (game uuid, token uuid, entry uuid);
insert into state values (null, null, null);
grant all on state to authenticated, anon;

-- A running game with one token and one log entry.
select tests.login((select dm from u));
update state set game = start_setup((select id from r), '00000000-0000-0000-0000-00000000007b', 'manual');
select set_composition((select game from state), '[{"role":"washerwoman"},{"role":"chef"},{"role":"drunk","shown":"empath"},{"role":"poisoner"},{"role":"imp"}]');
select assign_seat((select game from state), 1, 'washerwoman');
select assign_seat((select game from state), 2, 'chef');
select assign_seat((select game from state), 3, 'drunk');
select assign_seat((select game from state), 4, 'poisoner');
select assign_seat((select game from state), 5, 'imp');
select start_game((select game from state));
update state set token = add_token((select game from state), 2, 'poisoned');
update state set entry = add_log((select game from state), 1, '第一夜的信息');
select tests.logout();

create temp table actors (ord int, name text, uid uuid);
insert into actors values
  (1, 'admin', (select admin from u)), (2, 'dm', (select dm from u)), (3, 'dm-eligible', (select dme from u)),
  (4, 'player', (select player from u)), (5, 'guest', (select guest from u)), (6, 'outsider', (select outsider from u)),
  (7, 'signed-out', null);

-- %g = the game, %t = a token, %l = a log entry.
create temp table calls (ord int, name text, stmt text, running text[], ended text[]);
insert into calls values
  (1, 'add_token', $$select add_token(%g, 1, 'drunk')$$, '{dm}', '{}'),
  (2, 'remove_token', 'select remove_token(%t)', '{dm}', '{}'),
  (3, 'add_log', $$select add_log(%g, 2, '说明')$$, '{dm}', '{}'),
  (4, 'edit_log', $$select edit_log(%l, '改')$$, '{dm}', '{}'),
  (5, 'delete_log', 'select delete_log(%l)', '{dm}', '{}'),
  (6, 'set_seat_role', $$select set_seat_role(%g, 1, 'chef', 'chef')$$, '{dm}', '{}'),
  (7, 'set_alignment', $$select set_alignment(%g, 1, 'evil')$$, '{dm}', '{}');

create temp table outcomes (state text, state_ord int, call_ord int, actor_ord int, call text, actor text, expected text, actual text);

create function pg_temp.bind(p_stmt text) returns text language sql as $$
  select replace(replace(replace(p_stmt,
    '%g', quote_literal((select game from state))),
    '%t', quote_literal((select token from state))),
    '%l', quote_literal((select entry from state)));
$$;

create function pg_temp.record(p_state text, p_ord int) returns void language sql as $$
  insert into outcomes
  select p_state, p_ord, c.ord, a.ord, c.name, a.name,
         case when a.name = any (case p_state when 'running' then c.running else c.ended end) then 'allow' else 'deny' end,
         tests.try_as(a.uid, pg_temp.bind(c.stmt))
  from calls c cross join actors a;
$$;

select pg_temp.record('running', 1);

select tests.login((select dm from u));
select end_game((select game from state), 'evil');
select tests.logout();
select pg_temp.record('ended', 2);

select is(
  case when actual = 'allow' then 'allow' else 'deny' end,
  expected,
  format('M4.2 · TOKEN-01 · LOG-01 · M4 permission matrix: %s by %s (%s) → %s%s', call, actor, state, expected,
         case when actual <> 'allow' and expected = 'deny' then ' [' || actual || ']' else '' end)
)
from outcomes
order by state_ord, call_ord, actor_ord;

select * from finish();
