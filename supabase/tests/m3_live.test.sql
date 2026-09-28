-- M3 · the live game: phases, deaths, nominations and votes, the board, the end.
select * from no_plan();

create temp table u as
select tests.create_user('dora', 'dm_eligible') as dm,
       tests.create_user('p1') as p1, tests.create_user('p2') as p2, tests.create_user('p3') as p3,
       tests.create_user('p4') as p4, tests.create_user('p5') as p5,
       tests.create_user('olga') as onlooker, tests.create_user('sam') as stranger;
grant select on u to authenticated, anon;

insert into scripts (id, name, created_by) values ('00000000-0000-0000-0000-00000000007b', '暗流涌动', (select dm from u));
insert into script_roles (script_id, role_id, position)
select '00000000-0000-0000-0000-00000000007b', id, row_number() over (order by id) from roles where edition = 'tb';

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

create temp table g (id uuid, nom uuid, post1 uuid, post2 uuid, post3 uuid);
grant all on g to authenticated, anon;
insert into g (id) values (null);
select tests.login((select dm from u));
update g set id = start_setup((select id from r), '00000000-0000-0000-0000-00000000007b', 'manual');
select set_composition((select id from g), '[{"role":"washerwoman"},{"role":"chef"},{"role":"drunk","shown":"empath"},{"role":"poisoner"},{"role":"imp"}]');
select assign_seat((select id from g), 1, 'washerwoman');
select assign_seat((select id from g), 2, 'chef');
select assign_seat((select id from g), 3, 'drunk');
select assign_seat((select id from g), 4, 'poisoner');
select assign_seat((select id from g), 5, 'imp');
select start_game((select id from g));
select tests.logout();

create function pg_temp.phase() returns text language sql as $$
  select phase_kind || phase_number from public.games where id = (select id from g);
$$;
create function pg_temp.as_dm(p_sql text) returns void language plpgsql as $$
begin
  perform tests.login((select dm from u));
  execute p_sql;
  perform tests.logout();
end $$;
create function pg_temp.as_user(p_user uuid, p_sql text) returns void language plpgsql as $$
begin
  perform tests.login(p_user);
  execute p_sql;
  perform tests.logout();
end $$;
create function pg_temp.seat(p_seat int) returns public.game_seats language sql as $$
  select * from public.game_seats where game_id = (select id from g) and seat = p_seat;
$$;
create function pg_temp.vote(p_seat int) returns public.votes language sql as $$
  select * from public.votes where nomination_id = (select nom from g) and seat = p_seat;
$$;
create function pg_temp.nom() returns public.nominations language sql as $$
  select * from public.nominations where id = (select nom from g);
$$;

-- ───────────── PHASE ─────────────
select is(pg_temp.phase(), 'night1', 'PHASE-01: a game starts at 第1夜');
select is(tests.try_as((select p1 from u), format('select advance_phase(%L)', (select id from g))), 'NOT_DM', 'PHASE-02: a player cannot advance the phase');
select is(tests.try_as((select onlooker from u), format('select advance_phase(%L)', (select id from g))), 'NOT_DM', 'PHASE-02: nor can an onlooker');
select is(tests.try_as((select dm from u), format('select open_nomination(%L, 1, 2)', (select id from g))), 'NOT_DAY', 'PHASE-05: no nominations at night');
select pg_temp.as_dm(format('select advance_phase(%L)', (select id from g)));
select is(pg_temp.phase(), 'day1', 'PHASE-01 · PHASE-02: the DM advances night 1 → day 1');
select tests.login((select p2 from u));
select is((select phase_kind || phase_number from games where id = (select id from g)), 'day1', 'PHASE-02: players read the new phase');
select tests.logout();
select pg_temp.as_dm(format('select advance_phase(%L)', (select id from g)));
select is(pg_temp.phase(), 'night2', 'PHASE-01: day 1 → night 2');
select pg_temp.as_dm(format('select advance_phase(%L)', (select id from g)));
select is(pg_temp.phase(), 'day2', 'PHASE-01: night 2 → day 2');
select is(
  (select count(*)::int from pg_proc where pronamespace = 'public'::regnamespace and proname ~ '(undo|rewind|previous|back|set_phase)'),
  0, 'PHASE-04: there is no function to undo or set a phase: phases only move forward');

-- ───────────── DEATH ─────────────
select is(tests.try_as((select p1 from u), format($$select kill_seat(%L, 3, 'night')$$, (select id from g))), 'NOT_DM', 'DEATH-01: only the DM marks deaths');
select is(tests.try_as((select dm from u), format($$select kill_seat(%L, 6, 'night')$$, (select id from g))), 'SEAT_INVALID', 'DEATH-01: only the game''s seats');
select is(tests.try_as((select dm from u), format($$select kill_seat(%L, 3, 'other', %L)$$, (select id from g), repeat('长', 41))), 'NOTE_TOO_LONG', 'DEATH-01: the note has at most 40 characters');
select pg_temp.as_dm(format($$select kill_seat(%L, 3, 'night')$$, (select id from g)));
select pg_temp.as_dm(format($$select kill_seat(%L, 5, 'other', '被恶魔带走')$$, (select id from g)));
select tests.login((select p1 from u));
select is((select array[alive::text, death_cause::text] from game_seats where game_id = (select id from g) and seat = 3), array['false', 'night'], 'DEATH-01: everyone sees who died and why');
select is((select death_note from game_seats where game_id = (select id from g) and seat = 5), '被恶魔带走', 'DEATH-01: 其他 carries its optional text');
select is((select count(*)::int from game_deaths where game_id = (select id from g)), 2, 'DEATH-01: each death is kept for the summary');
select tests.logout();
select is(tests.try_as((select dm from u), format($$select kill_seat(%L, 3, 'executed')$$, (select id from g))), 'ALREADY_DEAD', 'DEATH-01: only a living player can be marked dead');
select is((pg_temp.seat(3)).ghost_vote_used, false, 'DEATH-04: a player who dies starts with an unused ghost vote');
select is(tests.try_as((select p3 from u), format('select set_ghost_vote(%L, 3, true)', (select id from g))), 'NOT_DM', 'DEATH-04: only the DM marks ghost votes');
select pg_temp.as_dm(format('select set_ghost_vote(%L, 5, true)', (select id from g)));
select is((pg_temp.seat(5)).ghost_vote_used, true, 'DEATH-04: the DM can mark a ghost vote used');
select pg_temp.as_dm(format('select set_ghost_vote(%L, 5, false)', (select id from g)));
select is((pg_temp.seat(5)).ghost_vote_used, false, 'DEATH-04: …and unused again');
select pg_temp.as_dm(format('select set_ghost_vote(%L, 5, true)', (select id from g)));
select pg_temp.as_dm(format('select revive_seat(%L, 5)', (select id from g)));
select is(array[(pg_temp.seat(5)).alive::text, coalesce((pg_temp.seat(5)).death_cause::text, 'none')], array['true', 'none'], 'DEATH-02: the DM revives a dead player');
select is((pg_temp.seat(5)).ghost_vote_used, true, 'DEATH-02: a revived player keeps their ghost-vote status');
select is(tests.try_as((select dm from u), format('select revive_seat(%L, 5)', (select id from g))), 'NOT_DEAD', 'DEATH-02: only a dead player can be revived');
select is(tests.try_as((select p5 from u), format('select revive_seat(%L, 3)', (select id from g))), 'NOT_DM', 'DEATH-02: only the DM revives');

-- Now: seats 1, 2, 4, 5 alive (5 has a spent ghost vote from before); seat 3 dead with an unused ghost vote.

-- ───────────── NOM / VOTE ─────────────
select is(tests.try_as((select p1 from u), format('select open_nomination(%L, 1, 2)', (select id from g))), 'NOT_DM', 'NOM-01: only the DM opens a nomination');
select tests.login((select dm from u));
update g set nom = open_nomination((select id from g), 1, 4);
select tests.logout();
select is((pg_temp.nom()).status::text, 'open', 'NOM-01: the DM opens a nomination by choosing nominator and nominee');
select is(tests.try_as((select dm from u), format('select open_nomination(%L, 2, 5)', (select id from g))), 'NOMINATION_OPEN', 'NOM-01: only one nomination at a time');
select is((select count(*)::int from votes where nomination_id = (select nom from g)), 5, 'VOTE-01: every seat has a hand, lowered to start with');

-- NOM-03: cancel before the circle starts.
select pg_temp.as_dm(format('select cancel_nomination(%L)', (select nom from g)));
select is((pg_temp.nom()).status::text, 'cancelled', 'NOM-03: the DM cancels an open nomination');
select tests.login((select dm from u));
update g set nom = open_nomination((select id from g), 1, 4);
select tests.logout();

-- VOTE-01 / VOTE-02
select pg_temp.as_user((select p1 from u), format('select set_hand(%L, true)', (select nom from g)));
select pg_temp.as_user((select p2 from u), format('select set_hand(%L, true)', (select nom from g)));
select pg_temp.as_user((select p2 from u), format('select set_hand(%L, false)', (select nom from g)));
select pg_temp.as_user((select p2 from u), format('select set_hand(%L, true)', (select nom from g)));
select tests.login((select p4 from u));
select is((select array_agg(seat order by seat) from votes where nomination_id = (select nom from g) and raised), array[1, 2], 'VOTE-01: players raise and lower hands freely, and everyone sees the hands');
select tests.logout();
select pg_temp.as_user((select p3 from u), format('select set_hand(%L, true)', (select nom from g)));
select is((pg_temp.vote(3)).raised, true, 'VOTE-01: a dead player with an unused ghost vote can raise');
select pg_temp.as_dm(format('select kill_seat(%L, 5, ''night'')', (select id from g)));
select is(tests.try_as((select p5 from u), format('select set_hand(%L, true)', (select nom from g))), 'GHOST_VOTE_SPENT', 'VOTE-02: a dead player whose ghost vote is spent cannot raise');
select is(tests.try_as((select p5 from u), format('select set_hand(%L, false)', (select nom from g))), 'allow', 'VOTE-02: …but lowering is always fine');
select is(tests.try_as((select onlooker from u), format('select set_hand(%L, true)', (select nom from g))), 'NOT_SEATED', 'VOTE-01: onlookers have no hand');
select is(tests.try_as((select dm from u), format('select close_vote(%L)', (select nom from g))), 'NOT_COUNTED', 'VOTE-13: a vote closes only after the circle completes');

-- Living: 1, 2, 4 → threshold 2.
select is(tests.try_as((select p1 from u), format('select start_vote(%L)', (select nom from g))), 'NOT_DM', 'VOTE-03: only the DM starts the circle');
select pg_temp.as_dm(format('select start_vote(%L)', (select nom from g)));
select is((pg_temp.nom()).threshold, 2, 'VOTE-10: the threshold is half the living players, rounded up (3 living → 2)');
select is(tests.try_as((select dm from u), format('select cancel_nomination(%L)', (select nom from g))), 'VOTE_STARTED', 'NOM-03: no cancelling once the circle has started');

-- The circle for nominee 4: 5, 1, 2, 3, 4.
select pg_temp.as_dm(format('select advance_vote(%L, 0)', (select nom from g)));
select is(array[(pg_temp.vote(5)).locked, (pg_temp.vote(5)).raised], array[true, false], 'VOTE-03 · VOTE-04: the hand passes seat 5 (after the nominee) first and locks its vote');
select pg_temp.as_dm(format('select advance_vote(%L, 0)', (select nom from g)));
select is((pg_temp.nom()).hand_index, 1, 'VOTE-05: a repeated tick (the same expected position) changes nothing');
select pg_temp.as_dm(format('select advance_vote(%L, 1)', (select nom from g)));
select is(array[(pg_temp.vote(1)).locked, (pg_temp.vote(1)).raised], array[true, true], 'VOTE-04: then seat 1, locked as it stands');
select is(tests.try_as((select p1 from u), format('select set_hand(%L, false)', (select nom from g))), 'VOTE_LOCKED', 'VOTE-04: a locked vote cannot be changed by the player');
select pg_temp.as_user((select p4 from u), format('select set_hand(%L, true)', (select nom from g)));
select is((pg_temp.vote(4)).raised, true, 'VOTE-01: seats the hand has not reached can still change');
select pg_temp.as_dm(format('select set_vote_paused(%L, true)', (select nom from g)));
select is((pg_temp.nom()).paused, true, 'VOTE-06: the DM pauses the clock hand');
select pg_temp.as_dm(format('select advance_vote(%L, 2)', (select nom from g)));
select is((pg_temp.nom()).hand_index, 3, 'VOTE-06: while paused, the DM can still step one seat at a time');
select pg_temp.as_dm(format('select set_vote_paused(%L, false)', (select nom from g)));
select is(tests.try_as((select dm from u), format('select set_vote_speed(%L, 400)', (select id from g))), 'SPEED_INVALID', 'VOTE-05: the speed is at least 0.5 s per seat');
select is(tests.try_as((select dm from u), format('select set_vote_speed(%L, 3100)', (select id from g))), 'SPEED_INVALID', 'VOTE-05: …and at most 3 s');
select pg_temp.as_dm(format('select set_vote_speed(%L, 2000)', (select id from g)));
select is((select vote_speed_ms from games where id = (select id from g)), 2000, 'VOTE-05: the DM sets the speed');
select is((select column_default from information_schema.columns where table_name = 'games' and column_name = 'vote_speed_ms'), '1500', 'VOTE-05: 1.5 s per seat by default');
select pg_temp.as_dm(format('select advance_vote(%L, 3)', (select nom from g)));
select is(array[(pg_temp.vote(3)).raised, (pg_temp.vote(3)).ghost_spent, (pg_temp.seat(3)).ghost_vote_used], array[true, true, true], 'VOTE-07: a dead player''s locked raised hand spends their ghost vote');
select pg_temp.as_dm(format('select advance_vote(%L, 4)', (select nom from g)));
select is((pg_temp.nom()).status::text, 'counted', 'VOTE-03: the circle ends with the nominee');
select is((pg_temp.nom()).vote_count, 4, 'VOTE-09: the count is the number of locked raised hands (1, 2, 3, 4)');
select is(tests.try_as((select dm from u), format('select advance_vote(%L, 5)', (select nom from g))), 'NOT_VOTING', 'VOTE-03: the circle visits each seat exactly once');

-- VOTE-08: corrections before closing.
select is(tests.try_as((select p2 from u), format('select correct_vote(%L, 2, false)', (select nom from g))), 'NOT_DM', 'VOTE-08: only the DM corrects votes');
select pg_temp.as_dm(format('select correct_vote(%L, 3, false)', (select nom from g)));
select is(array[(pg_temp.vote(3)).raised, (pg_temp.seat(3)).ghost_vote_used], array[false, false], 'VOTE-08: lowering a ghost vote refunds it');
select pg_temp.as_dm(format('select correct_vote(%L, 5, true)', (select nom from g)));
select is(array[(pg_temp.vote(5)).raised, (pg_temp.vote(5)).ghost_spent, (pg_temp.seat(5)).ghost_vote_used], array[true, true, true], 'VOTE-08: raising a dead player''s vote spends their ghost vote');
select pg_temp.as_dm(format('select correct_vote(%L, 2, false)', (select nom from g)));
select is((pg_temp.nom()).vote_count, 3, 'VOTE-08 · VOTE-09: the count follows the corrections');
select pg_temp.as_dm(format('select close_vote(%L)', (select nom from g)));
select is((pg_temp.nom()).status::text, 'closed', 'VOTE-13: the DM closes the vote');

-- VOTE-14: execution. Nominee 4 has 3 votes ≥ 2.
select is(tests.try_as((select p1 from u), format('select conclude_day(%L, true)', (select id from g))), 'NOT_DM', 'VOTE-14: only the DM confirms the execution');
select pg_temp.as_dm(format('select conclude_day(%L, true)', (select id from g)));
select is(array[(pg_temp.seat(4)).alive::text, (pg_temp.seat(4)).death_cause::text], array['false', 'executed'], 'VOTE-14: executing the player on the block marks them dead with cause 处决');
select is((select executed_seat from day_results where game_id = (select id from g) and day_number = 2), 4, 'VOTE-14: the day records who was executed');
select is(tests.try_as((select dm from u), format('select open_nomination(%L, 1, 2)', (select id from g))), 'DAY_OVER', 'VOTE-14: after the execution, the day has no more nominations');
select is(tests.try_as((select dm from u), format('select conclude_day(%L, false)', (select id from g))), 'DAY_OVER', 'VOTE-14: a day is concluded once');

-- A tie: day 3, nominees 1 and 2 with one vote each → nobody.
select pg_temp.as_dm(format('select advance_phase(%L)', (select id from g)));
select pg_temp.as_dm(format('select advance_phase(%L)', (select id from g)));
create function pg_temp.full_vote(p_nominator int, p_nominee int, p_raiser uuid) returns void language plpgsql as $$
begin
  perform tests.login((select dm from u));
  update g set nom = public.open_nomination((select id from g), p_nominator, p_nominee);
  perform tests.logout();
  perform pg_temp.as_user(p_raiser, format('select set_hand(%L, true)', (select nom from g)));
  perform tests.login((select dm from u));
  perform public.start_vote((select nom from g));
  for i in 0..4 loop
    perform public.advance_vote((select nom from g), i);
  end loop;
  perform public.close_vote((select nom from g));
  perform tests.logout();
end $$;
select pg_temp.full_vote(1, 2, (select p1 from u));
select pg_temp.full_vote(2, 1, (select p2 from u));
select is(tests.try_as((select dm from u), format('select conclude_day(%L, true)', (select id from g))), 'NOBODY_ON_BLOCK', 'VOTE-11: a tie for the highest count puts nobody on the block');
select pg_temp.as_dm(format('select conclude_day(%L, false)', (select id from g)));
select is((select executed_seat from day_results where game_id = (select id from g) and day_number = 3), null, 'VOTE-14: the DM confirms 无人处决');

-- ───────────── BOARD ─────────────
select tests.login((select p1 from u));
update g set post1 = post_board((select id from g), '  我是洗衣妇  ');
select tests.logout();
select tests.login((select p3 from u));
update g set post2 = post_board((select id from g), '死人也能说话');
select tests.logout();
select tests.login((select dm from u));
update g set post3 = post_board((select id from g), '天亮了');
select tests.logout();
select is((select array[seat::text, body, phase_kind || phase_number, is_dm::text] from board_posts where id = (select post1 from g)), array['1', '我是洗衣妇', 'day3', 'false'], 'BOARD-01 · BOARD-02: a post keeps its seat and phase, trimmed');
select is((select seat from board_posts where id = (select post2 from g)), 3, 'BOARD-01: dead players post too');
select is((select array[coalesce(seat::text, 'none'), is_dm::text] from board_posts where id = (select post3 from g)), array['none', 'true'], 'BOARD-01: DM posts are labelled 说书人');
select is(tests.try_as((select onlooker from u), format($$select post_board(%L, 'hi')$$, (select id from g))), 'NOT_SEATED', 'BOARD-01: onlookers cannot post');
select is(tests.try_as((select p2 from u), format($$select post_board(%L, '   ')$$, (select id from g))), 'POST_LENGTH', 'BOARD-01: at least 1 character');
select is(tests.try_as((select p2 from u), format($$select post_board(%L, %L)$$, (select id from g), repeat('字', 141))), 'POST_LENGTH', 'BOARD-01: at most 140 characters');
select is(tests.try_as((select p2 from u), format($$select post_board(%L, %L)$$, (select id from g), repeat('字', 140))), 'allow', 'BOARD-01: 140 characters is fine');
select is(tests.try_as((select p2 from u), format('select delete_post(%L)', (select post1 from g))), 'FORBIDDEN', 'BOARD-03: players cannot delete others'' posts');
select tests.login((select p1 from u));
update board_posts set body = '改过了' where id = (select post1 from g);
select tests.logout();
select is((select body from board_posts where id = (select post1 from g)), '我是洗衣妇', 'BOARD-03: posts cannot be edited');
select pg_temp.as_user((select p1 from u), format('select delete_post(%L)', (select post1 from g)));
select pg_temp.as_dm(format('select delete_post(%L)', (select post2 from g)));
select is((select count(*)::int from board_posts where game_id = (select id from g)), 1, 'BOARD-03: authors delete their own posts, the DM any post');
select tests.login((select onlooker from u));
select is((select count(*)::int from board_posts where game_id = (select id from g)), 1, 'BOARD-04: room members read the board');
select tests.logout();
select tests.login((select stranger from u));
select is((select count(*)::int from board_posts where game_id = (select id from g)), 0, 'BOARD-04: people outside the room cannot read its board');
select is((select count(*)::int from nominations where game_id = (select id from g)), 0, 'BOARD-04: …nor its nominations');
select tests.logout();

-- ───────────── END ─────────────
select pg_temp.as_dm(format('select advance_phase(%L)', (select id from g)));
select pg_temp.as_dm(format('select advance_phase(%L)', (select id from g)));
select tests.login((select dm from u));
update g set nom = open_nomination((select id from g), 1, 2);
select tests.logout();
select is(tests.try_as((select dm from u), format('select advance_phase(%L)', (select id from g))), 'NOMINATION_OPEN', 'PHASE-02: the phase cannot change during a nomination');
select is(tests.try_as((select p1 from u), format($$select end_game(%L, 'good')$$, (select id from g))), 'NOT_DM', 'END-01: only the DM ends the game');
select is(tests.try_as((select dm from u), format('select end_game(%L, null)', (select id from g))), 'WINNER_REQUIRED', 'END-01: the DM chooses the winning team');
select tests.login((select p1 from u));
select is((select count(*)::int from seat_roles where game_id = (select id from g)), 0, 'END-02: before the end, players still read no roles');
select tests.logout();
select pg_temp.as_dm(format($$select end_game(%L, 'evil')$$, (select id from g)));
select is((select array[status::text, winner::text] from games where id = (select id from g)), array['ended', 'evil'], 'END-01: the game ends with the chosen winner');
select is((pg_temp.nom()).status::text, 'cancelled', 'END-01: an open nomination is cancelled');
select tests.login((select p1 from u));
select is(
  (select array_agg(seat || ':' || actual_role_id || '/' || shown_role_id || '/' || alignment || '/' || starting_role_id order by seat) from seat_roles where game_id = (select id from g)),
  array['1:washerwoman/washerwoman/good/washerwoman', '2:chef/chef/good/chef', '3:drunk/empath/good/drunk', '4:poisoner/poisoner/evil/poisoner', '5:imp/imp/evil/imp'],
  'END-02: every seat''s final actual role, shown role and alignment are recorded, and the players can read them');
select tests.logout();
select is(tests.try_as((select dm from u), format($$select post_board(%L, 'late')$$, (select id from g))), 'NOT_IN_PROGRESS', 'END-02: the game is over: no more posts');
select is(tests.try_as((select dm from u), format($$select kill_seat(%L, 1, 'night')$$, (select id from g))), 'NOT_IN_PROGRESS', 'END-02: …or deaths');
select is((select count(*)::int from room_members where room_id = (select id from r) and seat is not null), 5, 'END-04: seats are kept');
select is(tests.try_as((select dm from u), format($$select start_setup(%L, '00000000-0000-0000-0000-00000000007b', 'draw')$$, (select id from r))), 'allow', 'END-04: the room is back in its lobby, ready for the next game');

select * from finish();
