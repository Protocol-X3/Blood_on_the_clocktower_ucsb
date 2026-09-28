-- M4 · grimoire: reminder tokens, the DM log, and mid-game role changes.
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

create temp table g (id uuid, tok uuid, tok2 uuid, log1 uuid, log2 uuid);
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

-- ───────────── TOKEN ─────────────
select is(tests.try_as((select p4 from u), format($$select add_token(%L, 2, 'poisoned')$$, (select id from g))), 'NOT_DM', 'TOKEN-01: only the DM adds tokens');
select tests.login((select dm from u));
update g set tok = add_token((select id from g), 2, 'poisoned');
update g set tok2 = add_token((select id from g), 3, 'drunk');
select add_token((select id from g), 1, 'reminder', (select reminders[1] from game_roles where game_id = (select id from g) and role_id = 'washerwoman'));
select add_token((select id from g), 5, 'custom', '  红鲱鱼  ');
select tests.logout();
select is(
  (select array_agg(seat || ':' || kind || ':' || label order by seat) from grimoire_tokens where game_id = (select id from g)),
  array['1:reminder:' || (select reminders[1] from game_roles where game_id = (select id from g) and role_id = 'washerwoman'), '2:poisoned:中毒', '3:drunk:醉酒', '5:custom:红鲱鱼'],
  'TOKEN-01: 中毒, 醉酒, a script reminder, or custom text');
select is(tests.try_as((select dm from u), format($$select add_token(%L, 1, 'custom', '一二三四五六七八九')$$, (select id from g))), 'TOKEN_TEXT_LENGTH', 'TOKEN-01: custom text has at most 8 characters');
select is(tests.try_as((select dm from u), format($$select add_token(%L, 1, 'custom', '一二三四五六七八')$$, (select id from g))), 'allow', 'TOKEN-01: 8 characters is fine');
select is(tests.try_as((select dm from u), format($$select add_token(%L, 1, 'reminder', '不存在的提示')$$, (select id from g))), 'TOKEN_NOT_IN_SCRIPT', 'TOKEN-01: reminders come from the script''s roles');
select is(tests.try_as((select dm from u), format($$select add_token(%L, 6, 'poisoned')$$, (select id from g))), 'SEAT_INVALID', 'TOKEN-01: only the game''s seats');
select is(tests.try_as((select p2 from u), format('select remove_token(%L)', (select tok from g))), 'NOT_DM', 'TOKEN-01: only the DM removes tokens');
select tests.login((select dm from u));
select remove_token((select tok from g));
select tests.logout();
select is((select count(*)::int from grimoire_tokens where game_id = (select id from g)), 3, 'TOKEN-01: the DM removes a token');

select tests.login((select p3 from u));
select is((select count(*)::int from grimoire_tokens where game_id = (select id from g)), 0, 'TOKEN-02 · M4.2: a player cannot read tokens, not even on their own seat');
select tests.logout();
select tests.login((select onlooker from u));
select is((select count(*)::int from grimoire_tokens where game_id = (select id from g)), 0, 'TOKEN-02 · M4.2: …nor can an onlooker');
select tests.logout();

-- ───────────── LOG ─────────────
select is(tests.try_as((select p1 from u), format($$select add_log(%L, 1, '偷看')$$, (select id from g))), 'NOT_DM', 'LOG-01: only the DM writes the log');
select tests.login((select dm from u));
update g set log1 = add_log((select id from g), 1, '得知 2号 或 4号 是厨师');
select advance_phase((select id from g));
update g set log2 = add_log((select id from g), null, '白天开始');
select tests.logout();
select is(
  (select array_agg(coalesce(seat::text, '-') || ':' || phase_kind || phase_number || ':' || body order by created_at) from dm_log where game_id = (select id from g)),
  array['1:night1:得知 2号 或 4号 是厨师', '-:day1:白天开始'],
  'LOG-01: each entry is tagged with the phase it was written in');
select is(tests.try_as((select dm from u), format($$select add_log(%L, 1, '   ')$$, (select id from g))), 'LOG_LENGTH', 'LOG-01: an entry is not empty');
select tests.login((select dm from u));
select edit_log((select log1 from g), '得知 2号 或 4号 是厨师（中毒）');
select delete_log((select log2 from g));
select tests.logout();
select is((select body || ':' || phase_kind || phase_number || ':' || (updated_at is not null) from dm_log where id = (select log1 from g)), '得知 2号 或 4号 是厨师（中毒）:night1:true', 'LOG-01: the DM edits an entry; it keeps its phase');
select is((select count(*)::int from dm_log where game_id = (select id from g)), 1, 'LOG-01: the DM deletes an entry');
select is(tests.try_as((select p1 from u), format($$select edit_log(%L, 'x')$$, (select log1 from g))), 'NOT_DM', 'LOG-01: players cannot edit the log');
select tests.login((select p1 from u));
select is((select count(*)::int from dm_log where game_id = (select id from g)), 0, 'LOG-02 · M4.2: until the game ends, only the DM sees the log');
select tests.logout();

-- ───────────── Role changes (GRIM-03) ─────────────
select is(tests.try_as((select p5 from u), format($$select set_seat_role(%L, 4, 'imp', 'imp')$$, (select id from g))), 'NOT_DM', 'GRIM-03: only the DM changes roles');
select is(tests.try_as((select dm from u), format($$select set_seat_role(%L, 4, 'vortox', 'vortox')$$, (select id from g))), 'ROLE_NOT_IN_SCRIPT', 'GRIM-03: the new role comes from the game''s script');
select tests.login((select dm from u));
select set_seat_role((select id from g), 4, 'imp', 'imp');
select set_seat_role((select id from g), 3, 'drunk', 'librarian');
select set_alignment((select id from g), 2, 'evil');
select tests.logout();
select is((select actual_role_id from seat_roles where game_id = (select id from g) and seat = 4), 'imp', 'GRIM-03: the DM changes an actual role (two seats may now share it)');
select tests.login((select p3 from u));
select is((select shown_role_id from seat_shown_roles where game_id = (select id from g)), 'librarian', 'GRIM-03: the player sees their new shown role');
select is((select count(*)::int from seat_roles where game_id = (select id from g)), 0, 'GRIM-03: …and still no actual role');
select tests.logout();
select is((select alignment::text from seat_roles where game_id = (select id from g) and seat = 2), 'evil', 'GRIM-03: the DM changes an alignment');
select is((select starting_role_id from seat_roles where game_id = (select id from g) and seat = 4), 'poisoner', 'GRIM-03: the starting role is kept (for stats)');

-- ───────────── After the end ─────────────
select tests.login((select dm from u));
select end_game((select id from g), 'good');
select tests.logout();
select is(tests.try_as((select dm from u), format($$select add_token(%L, 1, 'poisoned')$$, (select id from g))), 'NOT_IN_PROGRESS', 'TOKEN-01: no tokens after the end');
select is(tests.try_as((select dm from u), format($$select edit_log(%L, 'x')$$, (select log1 from g))), 'NOT_IN_PROGRESS', 'LOG-01: the log is final after the end');
select tests.login((select p1 from u));
select is((select count(*)::int from grimoire_tokens where game_id = (select id from g)), 3, 'TOKEN-02 · M4.2: after the end, the players see the tokens');
select is((select count(*)::int from dm_log where game_id = (select id from g)), 1, 'LOG-02 · M4.2: after the end, the log appears for the players');
select tests.logout();
select tests.login((select onlooker from u));
select is((select count(*)::int from dm_log where game_id = (select id from g)), 0, 'LOG-02: onlookers were not in the game and still see nothing');
select tests.logout();
select tests.login((select stranger from u));
select is((select count(*)::int from grimoire_tokens where game_id = (select id from g)), 0, 'TOKEN-02: nor do strangers');
select tests.logout();

select * from finish();
