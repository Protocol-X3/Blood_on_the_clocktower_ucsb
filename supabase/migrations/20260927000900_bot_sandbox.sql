-- M3 · Bot sandbox (docs/rules/m3-live-game.md: BOT-01, BOT-02)
--
-- A development tool: the DM fills empty seats with bot players, and the DM's
-- screen makes them draw, raise hands and post. The buttons exist only in
-- development builds (BOT-01). On the database side the functions work only while
-- private.app_config.bot_sandbox is 'on', which the launch cleanup turns off.

alter table public.profiles add column is_bot boolean not null default false;

insert into private.app_config (key, value) values ('bot_sandbox', 'on') on conflict (key) do nothing;

create function private.require_sandbox() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce((select value from private.app_config where key = 'bot_sandbox'), 'off') <> 'on' then
    perform private.fail('SANDBOX_OFF');
  end if;
end $$;

-- BOT-02: fill every empty seat with a bot (a guest account flagged is_bot, so it never has stats).
create function public.dev_add_bots(p_room uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms := private.require_room_dm(p_room);
  bot uuid;
  added int := 0;
begin
  perform private.require_sandbox();
  if private.game_active(p_room) then
    perform private.fail('GAME_IN_PROGRESS');
  end if;
  for s in 1..r.seat_count loop
    continue when exists (select 1 from public.room_members where room_id = p_room and seat = s);
    bot := gen_random_uuid();
    insert into auth.users (id, aud, role, is_anonymous, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values (bot, 'authenticated', 'authenticated', true, '{}'::jsonb, '{}'::jsonb, now(), now());
    -- Nicknames are unique: 机器人3-a1b2.
    update public.profiles set nickname = '机器人' || s || '-' || left(replace(bot::text, '-', ''), 4), is_bot = true where id = bot;
    insert into public.room_members (room_id, user_id, seat) values (p_room, bot, s);
    added := added + 1;
  end loop;
  perform private.touch(p_room);
  return added;
end $$;

-- Removes the room's bots between games.
create function public.dev_remove_bots(p_room uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  removed int;
begin
  perform private.require_room_dm(p_room);
  perform private.require_sandbox();
  if private.game_active(p_room) then
    perform private.fail('GAME_IN_PROGRESS');
  end if;
  with bots as (
    delete from public.room_members m using public.profiles p
    where m.room_id = p_room and p.id = m.user_id and p.is_bot
    returning m.user_id
  )
  select count(*) into removed from bots;
  perform private.touch(p_room);
  return removed;
end $$;

-- Runs the next statements as the bot, after checking the caller is the game's DM
-- and the bot sits in that game's room. Returns the caller's claims, to restore.
create function private.become_bot(p_game uuid, p_bot uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  claims text := current_setting('request.jwt.claims', true);
begin
  perform private.require_user();
  perform private.require_sandbox();
  if not private.is_game_dm(p_game) then
    perform private.fail('NOT_DM');
  end if;
  if not exists (
    select 1 from public.games g
    join public.room_members m on m.room_id = g.room_id and m.user_id = p_bot
    join public.profiles p on p.id = p_bot and p.is_bot
    where g.id = p_game
  ) then
    perform private.fail('NOT_A_BOT');
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', p_bot, 'role', 'authenticated')::text, true);
  return claims;
end $$;

create function private.restore_caller(p_claims text) returns void
language sql security definer set search_path = '' as $$
  select set_config('request.jwt.claims', coalesce(p_claims, ''), true);
$$;

-- The bot calls the same functions a player would.
create function public.dev_bot_draw(p_game uuid, p_bot uuid, p_card int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  claims text := private.become_bot(p_game, p_bot);
begin
  perform public.draw_card(p_game, p_card);
  perform private.restore_caller(claims);
end $$;

create function public.dev_bot_hand(p_nomination uuid, p_bot uuid, p_raised boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  claims text := private.become_bot((select game_id from public.nominations where id = p_nomination), p_bot);
begin
  perform public.set_hand(p_nomination, p_raised);
  perform private.restore_caller(claims);
end $$;

create function public.dev_bot_post(p_game uuid, p_bot uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  claims text := private.become_bot(p_game, p_bot);
begin
  perform public.post_board(p_game, p_body);
  perform private.restore_caller(claims);
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(uuid), private.is_game_member(uuid), private.is_game_dm(uuid), private.can_see_secrets(uuid) to authenticated;
