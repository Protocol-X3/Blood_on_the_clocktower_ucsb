-- M3 · the bot sandbox's database side (BOT-02). The UI exists only in development builds (BOT-01).
select * from no_plan();

create temp table u as
select tests.create_user('dora', 'dm_eligible') as dm, tests.create_user('p1') as p1, tests.create_user('dmitri', 'dm_eligible') as dme;
grant select on u to authenticated, anon;
insert into private.app_config (key, value) values ('bot_sandbox', 'on') on conflict (key) do update set value = 'on';

insert into scripts (id, name, created_by) values ('00000000-0000-0000-0000-00000000007b', '暗流涌动', (select dm from u));
insert into script_roles (script_id, role_id, position)
select '00000000-0000-0000-0000-00000000007b', id, row_number() over (order by id) from roles where edition = 'tb';

select tests.login((select dm from u));
create temp table r as select create_room(5) as code;
select tests.logout();
alter table r add column id uuid;
update r set id = (select id from rooms where code = (select code from r) and status = 'open');
grant select on r to authenticated, anon;
insert into room_members (room_id, user_id, seat) values ((select id from r), (select p1 from u), 1), ((select id from r), (select dme from u), null);

select is(tests.try_as((select p1 from u), format('select dev_add_bots(%L)', (select id from r))), 'NOT_DM', 'BOT-02: only the room''s DM adds bots');
select is(tests.try_as((select dme from u), format('select dev_add_bots(%L)', (select id from r))), 'NOT_DM', 'BOT-02: …not another DM-eligible member');

create temp table res (added int);
grant all on res to authenticated;
select tests.login((select dm from u));
insert into res select dev_add_bots((select id from r));
select tests.logout();
select is((select added from res), 4, 'BOT-02: the DM fills every empty seat with a bot');
select is(
  (select array_agg(m.seat || ':' || (p.nickname ~ ('^机器人' || m.seat || '-[0-9a-f]{4}$')) || ':' || p.is_bot || ':' || p.is_guest order by m.seat) from room_members m join profiles p on p.id = m.user_id where m.room_id = (select id from r) and p.is_bot),
  array['2:true:true:true', '3:true:true:true', '4:true:true:true', '5:true:true:true'],
  'BOT-02: bots are named 机器人N, flagged as bots, and are guests (no stats)');

create function pg_temp.bot(p_seat int) returns uuid language sql as $$
  select user_id from public.room_members where room_id = (select id from r) and seat = p_seat;
$$;

-- A card-draw game: bots draw through the real draw_card.
create temp table g (id uuid, nom uuid);
grant all on g to authenticated, anon;
insert into g values (null, null);
select tests.login((select dm from u));
update g set id = start_setup((select id from r), '00000000-0000-0000-0000-00000000007b', 'draw');
select set_composition((select id from g), '[{"role":"washerwoman"},{"role":"chef"},{"role":"drunk","shown":"empath"},{"role":"poisoner"},{"role":"imp"}]');
select shuffle_cards((select id from g));
select dev_bot_draw((select id from g), pg_temp.bot(2), 3);
select is(auth.uid(), (select dm from u), 'BOT-02: after acting for a bot, the DM is themselves again');
select tests.logout();
select is((select taken_by_seat from draw_slots where game_id = (select id from g) and card_no = 3), 2, 'BOT-02: a bot draws a card for its own seat');
select is(tests.try_as((select dm from u), format('select dev_bot_draw(%L, %L, 1)', (select id from g), (select p1 from u))), 'NOT_A_BOT', 'BOT-02: the DM cannot act for a real player');
select is(tests.try_as((select p1 from u), format('select dev_bot_draw(%L, %L, 1)', (select id from g), pg_temp.bot(3))), 'NOT_DM', 'BOT-02: only the DM drives the bots');
select is(tests.try_as((select dm from u), format('select dev_bot_draw(%L, %L, 3)', (select id from g), pg_temp.bot(4))), 'CARD_TAKEN', 'BOT-02: bots follow the same rules as players');
select is(tests.try_as((select dm from u), format('select dev_add_bots(%L)', (select id from r))), 'GAME_IN_PROGRESS', 'BOT-02: bots join between games');

select tests.login((select dm from u));
select dev_bot_draw((select id from g), pg_temp.bot(3), 1);
select dev_bot_draw((select id from g), pg_temp.bot(4), 2);
select dev_bot_draw((select id from g), pg_temp.bot(5), 4);
select tests.logout();
select tests.login((select p1 from u));
select draw_card((select id from g), 5);
select tests.logout();
select tests.login((select dm from u));
select start_game((select id from g));
select advance_phase((select id from g));
update g set nom = open_nomination((select id from g), 1, 2);
select dev_bot_hand((select nom from g), pg_temp.bot(3), true);
select dev_bot_post((select id from g), pg_temp.bot(4), '我是好人');
select tests.logout();
select is((select raised from votes where nomination_id = (select nom from g) and seat = 3), true, 'BOT-02: a bot raises its hand');
select is((select seat || ':' || body from board_posts where game_id = (select id from g)), '4:我是好人', 'BOT-02: a bot posts as its seat');

-- Off: the functions refuse.
update private.app_config set value = 'off' where key = 'bot_sandbox';
select is(tests.try_as((select dm from u), format('select dev_bot_hand(%L, %L, true)', (select nom from g), pg_temp.bot(5))), 'SANDBOX_OFF', 'BOT-01: with the sandbox off, bots cannot act');
select is(tests.try_as((select dm from u), format('select dev_remove_bots(%L)', (select id from r))), 'SANDBOX_OFF', 'BOT-01: …or be added or removed');
update private.app_config set value = 'on' where key = 'bot_sandbox';

select tests.login((select dm from u));
select end_game((select id from g), 'good');
update res set added = dev_remove_bots((select id from r));
select tests.logout();
select is((select added from res), 4, 'BOT-02: the DM removes the bots between games');
select is((select count(*)::int from room_members where room_id = (select id from r) and seat is not null), 1, 'BOT-02: only the real player is left seated');

select * from finish();
