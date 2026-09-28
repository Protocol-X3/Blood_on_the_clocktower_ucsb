-- M2 · setup wizard, card draw and role secrecy.
select * from no_plan();

create temp table u as
select tests.create_user('dora', 'dm_eligible') as dm,
       tests.create_user('p1') as p1, tests.create_user('p2') as p2, tests.create_user('p3') as p3,
       tests.create_user('p4') as p4, tests.create_user('p5') as p5,
       tests.create_user('olga') as onlooker,
       tests.create_user('q1') as q1, tests.create_user('q2') as q2, tests.create_user('q3') as q3,
       tests.create_user('q4') as q4, tests.create_user('q5') as q5, tests.create_user('ovid') as onlooker2;
grant select on u to authenticated, anon;

-- A Trouble Brewing script.
insert into scripts (id, name, created_by) values ('00000000-0000-0000-0000-00000000007b', '暗流涌动', (select dm from u));
insert into script_roles (script_id, role_id, position)
select '00000000-0000-0000-0000-00000000007b', id, row_number() over (order by id) from roles where edition = 'tb';

-- Room 1: five seated players and an onlooker.
select tests.login((select dm from u));
create temp table r as select create_room(5) as code;
select tests.logout();
alter table r add column id uuid;
update r set id = (select id from rooms where code = (select code from r) and status = 'open');
grant select on r to authenticated, anon;
insert into room_members (room_id, user_id, seat)
select (select id from r), x.uid, x.seat from (values
  ((select p1 from u), 1), ((select p2 from u), 2), ((select p3 from u), 3), ((select p4 from u), 4), ((select p5 from u), 5),
  ((select onlooker from u), null)) as x(uid, seat);

-- SETUP-05
select is(tests.try_as((select p1 from u), format($$ select start_setup(%L, '00000000-0000-0000-0000-00000000007b', 'manual') $$, (select id from r))),
  'NOT_DM', 'SETUP-05: only the room''s DM can start setup');

-- SETUP-11: not while a seat is empty.
delete from room_members where room_id = (select id from r) and seat = 5;
select is(tests.try_as((select dm from u), format($$ select start_setup(%L, '00000000-0000-0000-0000-00000000007b', 'manual') $$, (select id from r))),
  'NOT_ALL_SEATED', 'SETUP-11: setup cannot start while a seat is empty');
select is((select count(*)::int from games where room_id = (select id from r)), 0, 'SETUP-11: …and no setup was created');
insert into room_members (room_id, user_id, seat) values ((select id from r), (select p5 from u), 5);

create temp table g (id uuid);
grant all on g to authenticated, anon;
select tests.login((select dm from u));
insert into g select start_setup((select id from r), '00000000-0000-0000-0000-00000000007b', 'manual');
select tests.logout();
select is((select status::text from games where id = (select id from g)), 'setup', 'SETUP-05: the DM starts setup');

-- SETUP-06: back to basics discards the setup
select tests.login((select dm from u));
select cancel_setup((select id from g));
select tests.logout();
select is((select count(*)::int from games where room_id = (select id from r) and status <> 'ended'), 0, 'SETUP-06: going back to the basics step discards the setup');
select tests.login((select dm from u));
update g set id = start_setup((select id from r), '00000000-0000-0000-0000-00000000007b', 'manual');
select tests.logout();

-- SETUP-06: back at the basics step, the DM changes the mode or the script.
insert into scripts (id, name, created_by) values ('00000000-0000-0000-0000-0000000000b0', '黯月初升', (select dm from u));
insert into script_roles (script_id, role_id, position)
select '00000000-0000-0000-0000-0000000000b0', id, row_number() over (order by id) from roles where edition = 'bmr';
select tests.login((select dm from u));
select set_composition((select id from g), '[{"role":"washerwoman"},{"role":"chef"},{"role":"drunk","shown":"empath"},{"role":"poisoner"},{"role":"imp"}]');
select assign_seat((select id from g), 1, 'washerwoman');
select tests.logout();
select is(tests.try_as((select p1 from u), format($$ select update_setup(%L, '00000000-0000-0000-0000-00000000007b', 'draw') $$, (select id from g))),
  'NOT_DM', 'SETUP-05: only the DM changes the basics');
select is(tests.try_as((select dm from u), format($$ select update_setup(%L, '00000000-0000-0000-0000-00000000007b', null) $$, (select id from g))),
  'MODE_REQUIRED', 'SETUP-06: the basics still need an assignment mode');
select tests.login((select dm from u));
select update_setup((select id from g), '00000000-0000-0000-0000-00000000007b', 'manual');
select tests.logout();
select is((select count(*)::int from seat_roles where game_id = (select id from g)), 1, 'SETUP-06: going back without changing the basics keeps the assignments');
select tests.login((select dm from u));
select update_setup((select id from g), '00000000-0000-0000-0000-00000000007b', 'draw');
select tests.logout();
select is((select assignment_mode::text from games where id = (select id from g)), 'draw', 'SETUP-06: the DM can switch the assignment mode');
select is((select count(*)::int from game_composition where game_id = (select id from g)), 5, 'SETUP-06: switching the mode keeps the composition');
select is((select count(*)::int from seat_roles where game_id = (select id from g)), 0, 'SETUP-06: …and clears the assignments');
select tests.login((select dm from u));
select update_setup((select id from g), '00000000-0000-0000-0000-0000000000b0', 'draw');
select tests.logout();
select is((select script_id from games where id = (select id from g)), '00000000-0000-0000-0000-0000000000b0'::uuid, 'SETUP-06: the DM can switch the script');
select is((select count(*)::int from game_composition where game_id = (select id from g)), 0, 'SETUP-06: switching the script clears the composition');
select set_eq($$ select role_id from game_roles where game_id = (select id from g) $$, $$ select id from roles where edition = 'bmr' $$,
  'SETUP-06: …and the game''s roles become the new script''s');
-- Start over with the Trouble Brewing script for the rest of the file.
select tests.login((select dm from u));
select cancel_setup((select id from g));
update g set id = start_setup((select id from r), '00000000-0000-0000-0000-00000000007b', 'manual');
select tests.logout();

-- SETUP-07: composition rules
select is(tests.try_as((select dm from u), format($$ select set_composition(%L, '[{"role":"imp"},{"role":"chef"},{"role":"monk"},{"role":"spy"}]') $$, (select id from g))),
  'COMPOSITION_SIZE', 'SETUP-07: exactly as many roles as seats');
select is(tests.try_as((select dm from u), format($$ select set_composition(%L, '[{"role":"imp"},{"role":"chef"},{"role":"chef"},{"role":"spy"},{"role":"monk"}]') $$, (select id from g))),
  'COMPOSITION_DUPLICATE', 'SETUP-07: no role twice');
select is(tests.try_as((select dm from u), format($$ select set_composition(%L, '[{"role":"vortox"},{"role":"chef"},{"role":"monk"},{"role":"spy"},{"role":"empath"}]') $$, (select id from g))),
  'ROLE_NOT_IN_SCRIPT', 'SETUP-07: every role comes from the chosen script');
select is(tests.try_as((select dm from u), format($$ select set_composition(%L, '[{"role":"drunk","shown":"vortox"},{"role":"chef"},{"role":"monk"},{"role":"spy"},{"role":"imp"}]') $$, (select id from g))),
  'ROLE_NOT_IN_SCRIPT', 'SETUP-08: the shown role also comes from the script');
select is(tests.try_as((select p1 from u), format($$ select set_composition(%L, '[{"role":"imp"},{"role":"chef"},{"role":"monk"},{"role":"spy"},{"role":"empath"}]') $$, (select id from g))),
  'NOT_DM', 'SETUP-05: only the DM sets the composition');

select tests.login((select dm from u));
select set_composition((select id from g), '[{"role":"washerwoman"},{"role":"chef"},{"role":"drunk","shown":"empath"},{"role":"poisoner"},{"role":"imp"}]');
select tests.logout();
select is((select shown_role_id from game_composition where game_id = (select id from g) and role_id = 'drunk'), 'empath',
  'SETUP-08: the Drunk can be shown as a Townsfolk');
select is((select shown_role_id from game_composition where game_id = (select id from g) and role_id = 'chef'), 'chef',
  'SETUP-08: the shown role defaults to the role itself');

-- SETUP-09: manual assignment
select tests.login((select dm from u));
select assign_seat((select id from g), 1, 'washerwoman');
select assign_seat((select id from g), 2, 'chef');
select assign_seat((select id from g), 3, 'drunk');
select assign_seat((select id from g), 4, 'poisoner');
select tests.logout();
select is(tests.try_as((select dm from u), format($$ select assign_seat(%L, 5, 'chef') $$, (select id from g))), 'ROLE_ALREADY_ASSIGNED', 'SETUP-09: each role goes to exactly one seat');
select is(tests.try_as((select dm from u), format($$ select assign_seat(%L, 5, 'monk') $$, (select id from g))), 'ROLE_NOT_IN_COMPOSITION', 'SETUP-09: only roles from the composition');
select is(tests.try_as((select dm from u), format($$ select assign_seat(%L, 6, 'imp') $$, (select id from g))), 'SEAT_INVALID', 'SETUP-09: only the game''s seats');
select is(tests.try_as((select dm from u), format($$ select start_game(%L) $$, (select id from g))), 'NOT_ALL_ASSIGNED', 'SETUP-10: the game cannot start until every seat has a role');
select is(tests.try_as((select dm from u), format($$ select draw_card(%L, 1) $$, (select id from g))), 'WRONG_MODE', 'SETUP-09: no card draw in manual mode');

-- SECRET-01 during setup: players see nothing about roles yet.
select tests.login((select p1 from u));
select is((select count(*)::int from seat_roles), 0, 'SECRET-01 · M2.6: during setup a player cannot read any seat role');
select is((select count(*)::int from game_composition), 0, 'SECRET-01: …nor the composition');
select is((select count(*)::int from seat_shown_roles), 0, 'SECRET-01: in manual mode nobody sees a role before the game starts');
select is((select count(*)::int from game_roles where game_id = (select id from g)), 22, 'SECRET-01: players may read the script''s role list (it is public)');
select tests.logout();

select tests.login((select dm from u));
select assign_seat((select id from g), 5, 'imp');
select tests.logout();

-- SETUP-04: alignment from the actual role's team
select results_eq(
  format($$ select seat, alignment::text from seat_roles where game_id = %L order by seat $$, (select id from g)),
  $$ values (1, 'good'), (2, 'good'), (3, 'good'), (4, 'evil'), (5, 'evil') $$,
  'SETUP-04: Townsfolk and Outsiders start good, Minions and Demons evil');

-- SETUP-10: start
select is(tests.try_as((select p1 from u), format($$ select start_game(%L) $$, (select id from g))), 'NOT_DM', 'SETUP-10: only the DM starts the game');
select tests.login((select dm from u));
select start_game((select id from g));
select tests.logout();
select is((select row(status::text, phase_kind, phase_number)::text from games where id = (select id from g)), row('in_progress', 'night', 1)::text,
  'SETUP-10: the game starts at the first night');
select is(tests.try_as((select dm from u), format($$ select update_setup(%L, '00000000-0000-0000-0000-00000000007b', 'draw') $$, (select id from g))),
  'NOT_IN_SETUP', 'SETUP-06: once the game has started, there is no going back');
select is((select count(*)::int from game_seats where game_id = (select id from g)), 5, 'SETUP-10: every seat is in the game');
select is((select count(*)::int from seat_shown_roles where game_id = (select id from g)), 5, 'SETUP-10: every player''s role card appears at once');

-- SECRET-01 / SECRET-02 while the game runs
select tests.login((select p3 from u));
select is((select count(*)::int from seat_shown_roles), 1, 'SECRET-01 · M2.6: a player reads exactly one shown role: their own');
select is((select shown_role_id from seat_shown_roles), 'empath', 'SECRET-01 · M2.6: the Drunk sees the role they are shown, not "drunk"');
select is((select count(*)::int from seat_roles), 0, 'SECRET-01 · M2.6: a player never reads any actual role, not even their own');
select is((select count(*)::int from game_composition), 0, 'SECRET-01 · M2.6: …nor the composition');
select is((select count(*)::int from draw_cards), 0, 'SECRET-01 · M2.6: …nor any card');
select tests.logout();
select tests.login((select onlooker from u));
select is((select count(*)::int from seat_shown_roles), 0, 'SECRET-01: an onlooker reads no roles at all');
select tests.logout();
select tests.login((select dm from u));
select is((select count(*)::int from seat_roles where game_id = (select id from g)), 5, 'SECRET-02: the DM reads every seat''s role');
select is((select actual_role_id || '/' || shown_role_id from seat_roles where game_id = (select id from g) and seat = 3), 'drunk/empath',
  'SECRET-02: the DM sees both the actual and the shown role');
select tests.logout();

-- SECRET-03 after the game ends
update games set status = 'ended', ended_at = now() where id = (select id from g);
select tests.login((select p1 from u));
select is((select count(*)::int from seat_roles where game_id = (select id from g)), 5, 'SECRET-03: after the game every participant reads every role');
select is((select count(*)::int from game_composition where game_id = (select id from g)), 5, 'SECRET-03: …and the composition');
select tests.logout();
select tests.login((select onlooker from u));
select is((select count(*)::int from seat_roles where game_id = (select id from g)), 0, 'SECRET-03: onlookers were not participants and still see nothing');
select tests.logout();

-- ───────────── Card draw (room 2) ─────────────
select tests.login((select dm from u));
create temp table r2 as select create_room(5) as code;
select tests.logout();
alter table r2 add column id uuid;
update r2 set id = (select id from rooms where code = (select code from r2) and status = 'open');
grant select on r2 to authenticated, anon;
insert into room_members (room_id, user_id, seat)
select (select id from r2), x.uid, x.seat from (values
  ((select q1 from u), 1), ((select q2 from u), 2), ((select q3 from u), 3), ((select q4 from u), 4), ((select q5 from u), 5),
  ((select onlooker2 from u), null)) as x(uid, seat);
create temp table g2 (id uuid);
grant all on g2 to authenticated, anon;
select tests.login((select dm from u));
insert into g2 select start_setup((select id from r2), '00000000-0000-0000-0000-00000000007b', 'draw');
select set_composition((select id from g2), '[{"role":"washerwoman"},{"role":"chef"},{"role":"drunk","shown":"empath"},{"role":"poisoner"},{"role":"imp"}]');
select tests.logout();

select is(tests.try_as((select q1 from u), format($$ select draw_card(%L, 1) $$, (select id from g2))), 'NOT_SHUFFLED', 'DRAW-01: nothing to draw until the DM deals the cards');
select is(tests.try_as((select q1 from u), format($$ select shuffle_cards(%L) $$, (select id from g2))), 'NOT_DM', 'DRAW-01: only the DM deals');
select tests.login((select dm from u));
select shuffle_cards((select id from g2));
select tests.logout();
select is((select count(*)::int from draw_slots where game_id = (select id from g2) and taken_by_seat is null), 5, 'DRAW-01: one face-down card per role');

select tests.login((select q1 from u));
select draw_card((select id from g2), 1);
select is((select count(*)::int from seat_shown_roles), 1, 'DRAW-04: right after drawing, the player reads their own shown role');
select tests.logout();
select is(tests.try_as((select q1 from u), format($$ select draw_card(%L, 2) $$, (select id from g2))), 'ALREADY_DRAWN', 'DRAW-02: a player draws only one card');
select is(tests.try_as((select q2 from u), format($$ select draw_card(%L, 1) $$, (select id from g2))), 'CARD_TAKEN', 'DRAW-03: a taken card cannot be drawn again');
select is(tests.try_as((select q2 from u), format($$ select draw_card(%L, 9) $$, (select id from g2))), 'CARD_INVALID', 'DRAW-02: only existing cards');
select is(tests.try_as((select onlooker2 from u), format($$ select draw_card(%L, 2) $$, (select id from g2))), 'NOT_SEATED', 'DRAW-02: only seated players draw');
select is(tests.try_as((select dm from u), format($$ select draw_card(%L, 2) $$, (select id from g2))), 'NOT_SEATED', 'DRAW-02: the DM does not draw');

select tests.login((select q2 from u));
select is((select taken_by_seat from draw_slots where game_id = (select id from g2) and card_no = 1), 1, 'DRAW-04: other players see that card 1 was taken by seat 1');
select is((select count(*)::int from seat_shown_roles), 0, 'DRAW-04 · SECRET-01 · M2.6: …but not which role it was');
select is((select count(*)::int from draw_cards), 0, 'SECRET-01 · M2.6: players can never read the cards');
select is((select count(*)::int from seat_roles), 0, 'SECRET-01 · M2.6: …or seat roles during the draw');
select tests.logout();

select tests.login((select dm from u));
select is((select count(*)::int from seat_roles where game_id = (select id from g2)), 1, 'DRAW-05: the DM sees each drawn role live');
select shuffle_cards((select id from g2));
select tests.logout();
select is((select count(*)::int from draw_slots where game_id = (select id from g2) and taken_by_seat is not null), 0, 'DRAW-06: reshuffling resets every draw');
select is((select count(*)::int from seat_shown_roles where game_id = (select id from g2)), 0, 'DRAW-06: …and every revealed role');

select * from finish();
