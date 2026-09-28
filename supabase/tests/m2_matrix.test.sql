-- M2 permission matrix: every M2 action × every kind of user × lobby / setup (card draw) / setup (manual).
-- Each call runs as that user and is rolled back, so they don't affect each other.
select plan(231);

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

create temp table actors (ord int, name text, uid uuid);
insert into actors values
  (1, 'admin', (select admin from u)), (2, 'dm', (select dm from u)), (3, 'dm-eligible', (select dme from u)),
  (4, 'player', (select player from u)), (5, 'guest', (select guest from u)), (6, 'outsider', (select outsider from u)),
  (7, 'signed-out', null);

create temp table state (game uuid);
insert into state values ('00000000-0000-0000-0000-000000000000');
grant all on state to authenticated, anon;

-- Who may call what: lobby, setup with card draw, setup with manual assignment.
create temp table calls (ord int, name text, stmt text, lobby text[], draw text[], manual text[]);
insert into calls values
  (1, 'create_custom_role', $$select create_custom_role('测试角色', 'townsfolk', '测试能力')$$,
     '{admin,dm,dm-eligible}', '{admin,dm,dm-eligible}', '{admin,dm,dm-eligible}'),
  (2, 'save_script', $$select save_script(null, '测试剧本', null, array['imp'])$$,
     '{admin,dm,dm-eligible}', '{admin,dm,dm-eligible}', '{admin,dm,dm-eligible}'),
  (3, 'start_setup', format($$select start_setup(%L, '00000000-0000-0000-0000-00000000007b', 'manual')$$, (select id from r)), '{dm}', '{}', '{}'),
  (4, 'cancel_setup', 'select cancel_setup(%s)', '{}', '{dm}', '{dm}'),
  (5, 'set_composition', $$select set_composition(%s, '[{"role":"washerwoman"},{"role":"chef"},{"role":"drunk","shown":"empath"},{"role":"poisoner"},{"role":"imp"}]')$$, '{}', '{dm}', '{dm}'),
  (6, 'assign_seat', $$select assign_seat(%s, 1, 'washerwoman')$$, '{}', '{}', '{dm}'),
  (7, 'unassign_seat', 'select unassign_seat(%s, 1)', '{}', '{}', '{dm}'),
  (8, 'shuffle_cards', 'select shuffle_cards(%s)', '{}', '{dm}', '{}'),
  (9, 'draw_card (a free card)', 'select draw_card(%s, 1)', '{}', '{player,guest}', '{}'),
  (10, 'start_game', 'select start_game(%s)', '{}', '{}', '{dm}'),
  (11, 'update_setup', $$select update_setup(%s, '00000000-0000-0000-0000-00000000007b', 'draw')$$, '{}', '{dm}', '{dm}');

create temp table outcomes (state text, state_ord int, call_ord int, actor_ord int, call text, actor text, expected text, actual text);

create function pg_temp.record(p_state text, p_ord int) returns void language sql as $$
  insert into outcomes
  select p_state, p_ord, c.ord, a.ord, c.name, a.name,
         case when a.name = any (case p_state when 'lobby' then c.lobby when 'setup (draw)' then c.draw else c.manual end) then 'allow' else 'deny' end,
         tests.try_as(a.uid, case when c.stmt like '%\%s%' then format(c.stmt, quote_literal((select game from state))) else c.stmt end)
  from calls c cross join actors a;
$$;

select pg_temp.record('lobby', 1);

-- Setup with card draw: cards dealt, seats 3–5 have drawn, cards 1 and 2 are still free.
select tests.login((select dm from u));
update state set game = start_setup((select id from r), '00000000-0000-0000-0000-00000000007b', 'draw');
select set_composition((select game from state), '[{"role":"washerwoman"},{"role":"chef"},{"role":"drunk","shown":"empath"},{"role":"poisoner"},{"role":"imp"}]');
select shuffle_cards((select game from state));
select tests.logout();
select tests.login((select f3 from u)); select draw_card((select game from state), 3); select tests.logout();
select tests.login((select f4 from u)); select draw_card((select game from state), 4); select tests.logout();
select tests.login((select f5 from u)); select draw_card((select game from state), 5); select tests.logout();
select pg_temp.record('setup (draw)', 2);

-- Setup with manual assignment: every seat assigned.
select tests.login((select dm from u));
select cancel_setup((select game from state));
update state set game = start_setup((select id from r), '00000000-0000-0000-0000-00000000007b', 'manual');
select set_composition((select game from state), '[{"role":"washerwoman"},{"role":"chef"},{"role":"drunk","shown":"empath"},{"role":"poisoner"},{"role":"imp"}]');
select assign_seat((select game from state), 1, 'washerwoman');
select assign_seat((select game from state), 2, 'chef');
select assign_seat((select game from state), 3, 'drunk');
select assign_seat((select game from state), 4, 'poisoner');
select assign_seat((select game from state), 5, 'imp');
select tests.logout();
select pg_temp.record('setup (manual)', 3);

select is(
  case when actual = 'allow' then 'allow' else 'deny' end,
  expected,
  format('M2 permission matrix: %s by %s (%s) → %s%s', call, actor, state, expected,
         case when actual <> 'allow' and expected = 'deny' then ' [' || actual || ']' else '' end)
)
from outcomes
order by state_ord, call_ord, actor_ord;

select * from finish();
