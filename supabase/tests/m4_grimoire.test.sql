-- M4 · grimoire: reminder tokens, the DM log table, and mid-game role changes.
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

-- ───────────── LOG (the log table) ─────────────
-- Five players: the table opens with min(5, ⌊5 / 2⌋) = 2 nights and 2 days.
create function pg_temp.cells() returns text[] language sql as $$
  select coalesce(array_agg(coalesce(seat::text, (select label from dm_log_notes n where n.id = note_id)) || ':' || column_kind || coalesce(phase_number::text, '')
    || ':' || coalesce(body, '') || ':' || coalesce(mark::text, '') order by seat, note_id, column_kind, phase_number), '{}')
  from dm_log_cells where game_id = (select id from g);
$$;
select is(
  (select array_agg(seat || ':' || mark order by seat) from dm_log_row_marks where game_id = (select id from g)),
  array['3:yellow', '4:red', '5:red'],
  'LOG-06: when the game starts, evil rows are red and outsider rows yellow');
select is(tests.try_as((select p1 from u), format($$select set_log_cell(%L, 1, null, 'night', 1, '偷看')$$, (select id from g))), 'NOT_DM', 'LOG-01: only the DM writes the log');
select tests.login((select dm from u));
select set_log_cell((select id from g), 1, null, 'night', 1, '  得知 2号 或 4号 是厨师  ');
select set_log_cell((select id from g), 3, null, 'setup', null, '以为自己是共情者');
select set_log_cell((select id from g), 2, null, 'day', 2, '提前记：明天要跳厨师');
select tests.logout();
select is(pg_temp.cells(), array['1:night1:得知 2号 或 4号 是厨师:', '2:day2:提前记：明天要跳厨师:', '3:setup:以为自己是共情者:'],
  'LOG-01: one text per cell, in 角色设置 or any night or day the table shows');
select tests.login((select dm from u));
select set_log_cell((select id from g), 1, null, 'night', 1, '得知 2号 或 4号 是厨师（中毒）');
select tests.logout();
select is((select count(*)::int from dm_log_cells where game_id = (select id from g) and seat = 1), 1, 'LOG-01: writing a cell again changes it, not a second entry');
select is((select body from dm_log_cells where game_id = (select id from g) and seat = 1), '得知 2号 或 4号 是厨师（中毒）', 'LOG-01: …with the new text');
select is(tests.try_as((select dm from u), format($$select set_log_cell(%L, 1, null, 'night', 1, %L)$$, (select id from g), repeat('字', 501))), 'LOG_LENGTH', 'LOG-01: a cell holds at most 500 characters');
select is(tests.try_as((select dm from u), format($$select set_log_cell(%L, 1, null, 'night', 1, %L)$$, (select id from g), repeat('字', 500))), 'allow', 'LOG-01: 500 is fine');
select is(tests.try_as((select dm from u), format($$select set_log_cell(%L, 1, null, 'night', 3, 'x')$$, (select id from g))), 'LOG_COLUMN_INVALID', 'LOG-01: no column past the ones the table shows');
select is(tests.try_as((select dm from u), format($$select set_log_cell(%L, 1, null, 'name', null, 'x')$$, (select id from g))), 'LOG_COLUMN_INVALID', 'LOG-01: 座位 / 玩家 / 初始角色 hold no text');
select is(tests.try_as((select dm from u), format($$select set_log_cell(%L, 1, null, 'setup', 1, 'x')$$, (select id from g))), 'LOG_COLUMN_INVALID', 'LOG-01: 角色设置 has no phase');
select is(tests.try_as((select dm from u), format($$select set_log_cell(%L, null, null, 'setup', null, 'x')$$, (select id from g))), 'LOG_ROW_INVALID', 'LOG-01: a cell belongs to a seat or a note row');
select is(tests.try_as((select dm from u), format($$select set_log_cell(%L, 6, null, 'setup', null, 'x')$$, (select id from g))), 'SEAT_INVALID', 'LOG-01: only the game''s seats');
select tests.login((select dm from u));
select set_log_cell((select id from g), 2, null, 'day', 2, '   ');
select tests.logout();
select is((select count(*)::int from dm_log_cells where game_id = (select id from g) and seat = 2), 0, 'LOG-01: clearing a cell''s text removes it');

-- LOG-05: note rows
select is(tests.try_as((select p1 from u), format($$select add_log_note(%L, '整局')$$, (select id from g))), 'NOT_DM', 'LOG-05: only the DM adds note rows');
select tests.login((select dm from u));
update g set log1 = add_log_note((select id from g), ' 整局 ');
update g set log2 = add_log_note((select id from g), '');
select set_log_cell((select id from g), null, (select log2 from g), 'night', 1, '僧侣 / 圣徒 / 士兵');
select set_log_cell((select id from g), null, (select log1 from g), 'day', 1, '要删掉的');
select rename_log_note((select log2 from g), '恶魔伪装');
select tests.logout();
select is((select array_agg(label || ':' || position order by position) from dm_log_notes where game_id = (select id from g)), array['整局:1', '恶魔伪装:2'],
  'LOG-05: the DM adds note rows at the bottom, with an optional label, and renames them');
select is(tests.try_as((select dm from u), format($$select add_log_note(%L, '十三个字的备注行名称太长了')$$, (select id from g))), 'LOG_LABEL_LENGTH', 'LOG-05: a label has at most 12 characters');
select is(tests.try_as((select p2 from u), format($$select rename_log_note(%L, 'x')$$, (select log1 from g))), 'NOT_DM', 'LOG-05: players cannot rename note rows');
select is(tests.try_as((select dm from u), format($$select set_log_cell(%L, null, gen_random_uuid(), 'setup', null, 'x')$$, (select id from g))), 'LOG_NOTE_NOT_FOUND', 'LOG-05: a note row of this game');
select tests.login((select dm from u));
select delete_log_note((select log1 from g));
select tests.logout();
select is((select count(*)::int from dm_log_notes where game_id = (select id from g)), 1, 'LOG-05: the DM deletes a note row');
select is((select count(*)::int from dm_log_cells where game_id = (select id from g) and note_id is not null), 1, 'LOG-05: …and its cells go with it');

-- LOG-06: colours
select is(tests.try_as((select p1 from u), format($$select mark_log_cells(%L, '[{"seat":1,"column":"night","phase":1}]', 'green')$$, (select id from g))), 'NOT_DM', 'LOG-06: only the DM colours cells');
select tests.login((select dm from u));
-- A rectangle: seats 1–2 × 第1夜…第1天.
select mark_log_cells((select id from g), '[{"seat":1,"column":"night","phase":1},{"seat":1,"column":"day","phase":1},{"seat":2,"column":"night","phase":1},{"seat":2,"column":"day","phase":1}]', 'violet');
select mark_log_cells((select id from g), jsonb_build_array(jsonb_build_object('note', (select log2 from g), 'column', 'night', 'phase', 1), jsonb_build_object('seat', 5, 'column', 'name')), 'dead');
select tests.logout();
select is(pg_temp.cells(), array['1:day1::violet', '1:night1:得知 2号 或 4号 是厨师（中毒）:violet', '2:day1::violet', '2:night1::violet', '3:setup:以为自己是共情者:', '5:name::dead', '恶魔伪装:night1:僧侣 / 圣徒 / 士兵:dead'],
  'LOG-06: one stroke colours a whole rectangle, on text or empty cells, 玩家 and note rows included');
select tests.login((select dm from u));
select mark_log_cells((select id from g), '[{"seat":2,"column":"night","phase":1},{"seat":4,"column":"setup"}]', 'clear');
select set_log_cell((select id from g), 1, null, 'night', 1, '');
select tests.logout();
select is((select count(*)::int from dm_log_cells where game_id = (select id from g) and seat = 2 and column_kind = 'night'), 0, 'LOG-06: clearing the colour of an empty cell removes it');
select is((select mark::text from dm_log_cells where game_id = (select id from g) and seat = 4), 'none', 'LOG-06: clearing a cell in a red row keeps it clear of the row''s colour');
select is((select coalesce(body, '') || ':' || mark from dm_log_cells where game_id = (select id from g) and seat = 1 and column_kind = 'night'), ':violet', 'LOG-06: clearing the text keeps the colour');
select tests.login((select dm from u));
select mark_log_cells((select id from g), '[{"seat":5,"column":"setup"}]', 'green');
select mark_log_cells((select id from g), '[{"seat":5,"column":"setup"}]', 'unset');
select tests.logout();
select is((select count(*)::int from dm_log_cells where game_id = (select id from g) and seat = 5 and column_kind = 'setup'), 0, 'LOG-06: 撤销 can drop a cell''s own colour, so its red row shows through again');
select is(tests.try_as((select dm from u), format($$select mark_log_cells(%L, '[{"seat":1,"column":"setup"}]', 'none')$$, (select id from g))), 'LOG_MARK_INVALID', 'LOG-06: only the five colours or clear');
select is(tests.try_as((select dm from u), format($$select mark_log_cells(%L, '[{"seat":"x","column":"setup"}]', 'red')$$, (select id from g))), 'LOG_CELLS_INVALID', 'LOG-06: cells are well formed');
select is(tests.try_as((select dm from u), format($$select mark_log_cells(%L, '[]', 'red')$$, (select id from g))), 'LOG_CELLS_INVALID', 'LOG-06: at least one cell');
select is(tests.try_as((select dm from u), format($$select mark_log_cells(%L, '[{"seat":1,"column":"night","phase":1},{"seat":1,"column":"night","phase":9}]', 'red')$$, (select id from g))), 'LOG_COLUMN_INVALID', 'LOG-06: a stroke with a bad cell changes nothing');
select is((select mark::text from dm_log_cells where game_id = (select id from g) and seat = 1 and column_kind = 'night'), 'violet', 'LOG-06: …not even its good cells');
select is((select count(*)::int from dm_log_cells c join game_seats s using (game_id, seat) where c.game_id = (select id from g) and c.mark = 'dead' and s.alive), 1,
  'LOG-06: deaths are marked by hand only (seat 5 is alive, yet the DM marked it)');

-- LOG-03 / LOG-01: earlier phases stay editable; the table grows with the game.
select tests.login((select dm from u));
select advance_phase((select id from g));
select set_log_cell((select id from g), 3, null, 'night', 1, '事后补记');
select advance_phase((select id from g));
select advance_phase((select id from g));
select advance_phase((select id from g));
select tests.logout();
select is((select body from dm_log_cells where game_id = (select id from g) and seat = 3 and column_kind = 'night'), '事后补记', 'LOG-03: by day the DM still edits 第1夜');
select is(tests.try_as((select dm from u), format($$select set_log_cell(%L, 3, null, 'night', 3, '第3夜')$$, (select id from g))), 'allow', 'LOG-01: on 第3夜 the table has grown to 3 nights and days');
select is(tests.try_as((select dm from u), format($$select set_log_cell(%L, 3, null, 'night', 4, '第4夜')$$, (select id from g))), 'LOG_COLUMN_INVALID', 'LOG-01: …and no further');

select tests.login((select p1 from u));
select is((select count(*)::int from dm_log_cells where game_id = (select id from g)), 0, 'LOG-02 · M4.2: until the game ends, only the DM sees the log');
select is((select count(*)::int from dm_log_notes where game_id = (select id from g)) + (select count(*)::int from dm_log_row_marks where game_id = (select id from g)), 0,
  'LOG-02 · M4.2: …its note rows and row colours too');
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
select is(tests.try_as((select dm from u), format($$select set_log_cell(%L, 1, null, 'setup', null, 'x')$$, (select id from g))), 'NOT_IN_PROGRESS', 'LOG-01: the log is final after the end');
select is(tests.try_as((select dm from u), format($$select mark_log_cells(%L, '[{"seat":1,"column":"setup"}]', 'red')$$, (select id from g))), 'NOT_IN_PROGRESS', 'LOG-06: …its colours too');
select is(tests.try_as((select dm from u), format($$select add_log_note(%L, 'x')$$, (select id from g))), 'NOT_IN_PROGRESS', 'LOG-05: …and its note rows');
select tests.login((select p1 from u));
select is((select count(*)::int from grimoire_tokens where game_id = (select id from g)), 3, 'TOKEN-02 · M4.2: after the end, the players see the tokens');
select is((select count(*)::int from dm_log_cells where game_id = (select id from g)), 8, 'LOG-02 · M4.2: after the end, the log appears for the players');
select is((select count(*)::int from dm_log_notes where game_id = (select id from g)), 1, 'LOG-02: …with its note rows');
select is((select count(*)::int from dm_log_row_marks where game_id = (select id from g)), 3, 'LOG-02: …and row colours');
select tests.logout();
select tests.login((select onlooker from u));
select is((select count(*)::int from dm_log_cells where game_id = (select id from g)), 0, 'LOG-02: onlookers were not in the game and still see nothing');
select tests.logout();
select tests.login((select stranger from u));
select is((select count(*)::int from grimoire_tokens where game_id = (select id from g)), 0, 'TOKEN-02: nor do strangers');
select tests.logout();

select * from finish();
