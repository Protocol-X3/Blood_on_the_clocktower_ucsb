-- AUTH-10: accounts nobody can use any more are removed automatically.
select * from no_plan();

create temp table u as
select tests.create_user('gone', 'player', true) as signed_out,      -- guest, no session, 2 hours old
       tests.create_user('fresh', 'player', true) as signing_in,     -- guest, no session yet, just created
       tests.create_user('here', 'player', true) as active,          -- guest, session refreshed today
       tests.create_user('idle', 'player', true) as idle,            -- guest, session idle for 31 days
       tests.create_user('played', 'player', true) as played,        -- guest, signed out, has a seat in a past game
       tests.create_user('seated', 'player', true) as in_room,       -- guest, signed out, member of an open room
       tests.create_user('robot', 'player', true) as bot,            -- a bot: a guest with no session by design
       tests.create_user('noname1') as nameless_old,                 -- Google, no nickname, 2 days old
       tests.create_user('noname2', 'player', true) as nameless_new, -- guest, no nickname, signed in a minute ago
       tests.create_user('noname3') as nameless_dm,                  -- DM-eligible, no nickname, 2 days old
       tests.create_user('gina') as google,                          -- Google, named, signed out long ago
       tests.create_user('dora', 'dm_eligible') as dm;

update auth.users set created_at = now() - interval '2 hours' where id in (select signed_out from u);
update auth.users set created_at = now() - interval '2 days'
where id in (select unnest(array[played, in_room, bot, nameless_old, nameless_dm]) from u);
update auth.users set created_at = now() - interval '90 days' where id in (select unnest(array[active, idle, google]) from u);
update public.profiles set nickname = null where id in (select unnest(array[nameless_old, nameless_new, nameless_dm]) from u);
update public.profiles set permission = 'dm_eligible' where id = (select nameless_dm from u);
update public.profiles set is_bot = true where id = (select bot from u);

insert into auth.sessions (id, user_id, created_at, updated_at, refreshed_at)
select gen_random_uuid(), active, now() - interval '89 days', now() - interval '40 days', (now() - interval '20 minutes') at time zone 'utc' from u
union all select gen_random_uuid(), idle, now() - interval '89 days', now() - interval '31 days', (now() - interval '31 days') at time zone 'utc' from u
union all select gen_random_uuid(), nameless_new, now(), now(), null from u;

-- A past game with one of the guests seated, and an open room with another.
create temp table r as select gen_random_uuid() as past, gen_random_uuid() as open, gen_random_uuid() as game;
insert into public.rooms (id, code, created_by, dm_id, status, closed_at) select past, 'QQQ7', dm, dm, 'closed', now() from r, u;
insert into public.rooms (id, code, created_by, dm_id) select open, 'QQQ8', dm, dm from r, u;
insert into public.games (id, room_id, dm_id, status, ended_at) select game, past, dm, 'ended', now() from r, u;
insert into public.game_seats (game_id, seat, user_id) select game, 1, played from r, u;
insert into public.room_members (room_id, user_id, seat) select open, in_room, 1 from r, u;

select is(tests.try_as((select dm from u), 'select private.cleanup_accounts()'), 'permission denied for function cleanup_accounts', 'AUTH-10: nobody can run the cleanup by hand');
select ok(private.cleanup_accounts() >= 3, 'AUTH-10: the cleanup removes accounts and reports how many');

create function pg_temp.kept(p_user uuid) returns boolean language sql as $$
  select exists (select 1 from auth.users where id = p_user) and exists (select 1 from public.profiles where id = p_user);
$$;

select is(pg_temp.kept((select signed_out from u)), false, 'AUTH-10: a guest who signed out is removed, profile and all');
select is(pg_temp.kept((select signing_in from u)), true, 'AUTH-10: …but not within an hour of being created, while sign-in is still under way');
select is(pg_temp.kept((select active from u)), true, 'AUTH-10: a guest whose session is in use stays, however old the account');
select is(pg_temp.kept((select idle from u)), false, 'AUTH-10: a guest whose session has been idle for 30 days is removed');
select is(pg_temp.kept((select played from u)), true, 'AUTH-10: a guest with a seat in a past game stays, so history and stats keep their name');
select is((select user_id from public.game_seats where game_id = (select game from r) and seat = 1), (select played from u), 'AUTH-10: …and the game still names them');
select is(pg_temp.kept((select in_room from u)), true, 'AUTH-10: a member of an open room stays');
select is(pg_temp.kept((select bot from u)), true, 'AUTH-10: bots are left to the sandbox');
select is(pg_temp.kept((select nameless_old from u)), false, 'AUTH-10: an account still without a nickname after a day is removed, Google or guest');
select is(pg_temp.kept((select nameless_new from u)), true, 'AUTH-10: …but not one that is still choosing a nickname');
select is(pg_temp.kept((select nameless_dm from u)), true, 'AUTH-10: DM-eligible accounts are never removed');
select is(pg_temp.kept((select google from u)), true, 'AUTH-10: a Google account stays without a session: it can always sign in again');
select is(pg_temp.kept((select dm from u)), true, 'AUTH-10: …and so does the DM');

-- Once the room closes, its signed-out guest goes too.
update public.rooms set status = 'closed', closed_at = now() where id = (select open from r);
select is(private.cleanup_accounts(), 1, 'AUTH-10: a later run removes only what has become unreachable since');
select is(pg_temp.kept((select in_room from u)), false, 'AUTH-10: a signed-out guest goes once their room has closed');

select is((select schedule || ' ' || command from cron.job where jobname = 'cleanup-accounts'), '30 11 * * * select private.cleanup_accounts()', 'AUTH-10: the cleanup runs once a day');

select * from finish();
