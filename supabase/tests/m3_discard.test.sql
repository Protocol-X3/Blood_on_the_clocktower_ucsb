-- END-05: the DM discards a running game; nothing of it is kept, so it never reaches stats or history.
select * from no_plan();

create temp table u as
select tests.create_user('dora', 'dm_eligible') as dm,
       tests.create_user('p1') as p1, tests.create_user('p2') as p2, tests.create_user('p3') as p3,
       tests.create_user('p4') as p4, tests.create_user('p5') as p5;
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
  ((select p1 from u), 1), ((select p2 from u), 2), ((select p3 from u), 3), ((select p4 from u), 4), ((select p5 from u), 5)) as x(uid, seat);

create temp table g (id uuid, ended uuid);
grant all on g to authenticated, anon;
insert into g values (null, null);

create function pg_temp.play() returns uuid language plpgsql as $$
declare
  v_game uuid;
begin
  perform tests.login((select dm from u));
  v_game := start_setup((select id from r), '00000000-0000-0000-0000-00000000007b', 'manual');
  perform set_composition(v_game, '[{"role":"washerwoman"},{"role":"chef"},{"role":"drunk","shown":"empath"},{"role":"poisoner"},{"role":"imp"}]');
  perform assign_seat(v_game, 1, 'washerwoman');
  perform assign_seat(v_game, 2, 'chef');
  perform assign_seat(v_game, 3, 'drunk');
  perform assign_seat(v_game, 4, 'poisoner');
  perform assign_seat(v_game, 5, 'imp');
  perform start_game(v_game);
  perform kill_seat(v_game, 4, 'night');
  perform add_token(v_game, 2, 'poisoned');
  perform set_log_cell(v_game, 1, null, 'night', 1, '得知 2号 或 4号 是厨师');
  perform post_board(v_game, '说书人公告');
  perform advance_phase(v_game);
  perform open_nomination(v_game, 1, 2);
  perform tests.logout();
  return v_game;
end $$;

-- One game played to the end, then a second one that gets discarded.
update g set ended = pg_temp.play();
select tests.login((select dm from u));
select end_game((select ended from g), 'good');
select tests.logout();
update g set id = pg_temp.play();

select is(tests.try_as((select p1 from u), format('select discard_game(%L)', (select id from g))), 'NOT_DM', 'END-05: only the DM discards the game');
select is(tests.try_as((select dm from u), format('select discard_game(%L)', (select ended from g))), 'NOT_IN_PROGRESS', 'END-05: an ended game stays recorded');
select tests.login((select dm from u));
select discard_game((select id from g));
select tests.logout();

select is((select count(*)::int from games where id = (select id from g)), 0, 'END-05: the discarded game is gone');
select is(
  (select count(*)::int from game_seats where game_id = (select id from g)) + (select count(*)::int from seat_roles where game_id = (select id from g))
  + (select count(*)::int from nominations where game_id = (select id from g)) + (select count(*)::int from board_posts where game_id = (select id from g))
  + (select count(*)::int from game_deaths where game_id = (select id from g)) + (select count(*)::int from grimoire_tokens where game_id = (select id from g))
  + (select count(*)::int from dm_log_cells where game_id = (select id from g)) + (select count(*)::int from dm_log_row_marks where game_id = (select id from g)),
  0,
  'END-05: …with everything recorded in it');
select is((select count(*)::int from games where id = (select ended from g)), 1, 'END-05: the earlier, ended game is untouched');

select tests.login((select p1 from u));
select is((select count(*)::int from profile_stat_rows((select p1 from u))), 1, 'END-05: stats count only the ended game');
select is((select count(*)::int from profile_history((select p1 from u))), 1, 'END-05: …and so does history');
select tests.logout();
select tests.login((select dm from u));
select is((select count(*)::int from profile_stat_rows((select dm from u)) where as_dm), 1, 'END-05: the DM''s games as DM too');
select tests.logout();

select is((select count(*)::int from room_members where room_id = (select id from r) and seat is not null), 5, 'END-05: back in the lobby, seats are kept');
select is(tests.try_as((select dm from u), format($$select start_setup(%L, '00000000-0000-0000-0000-00000000007b', 'manual')$$, (select id from r))), 'allow',
  'END-05: …and the DM can set up the next game');

select * from finish();
