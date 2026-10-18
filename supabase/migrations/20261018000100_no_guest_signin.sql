-- AUTH-02: guest sign-in (游客登录) is turned off (2026-10-18). Supabase's "Allow anonymous
-- sign-ins" setting is off as well; this is the database's backstop in case it is turned on
-- again: no anonymous account is created through sign-in. The bot sandbox still creates its
-- bots (guest accounts flagged is_bot) by saying so first.

-- PERM-01 / PERM-02: every new account is a player, except the configured admin.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.is_anonymous, false) and coalesce(current_setting('botc.allow_guest_account', true), '') <> 'on' then
    perform private.fail('GUEST_SIGNIN_DISABLED');
  end if;
  insert into public.profiles (id, is_guest, permission)
  values (
    new.id,
    coalesce(new.is_anonymous, false),
    case
      when not coalesce(new.is_anonymous, false) and private.is_admin_email(new.email)
        and not exists (select 1 from public.profiles where permission = 'admin')
      then 'admin'::public.permission_level
      else 'player'::public.permission_level
    end
  );
  return new;
end $$;

-- BOT-02: fill every empty seat with a bot (a guest account flagged is_bot, so it never has stats).
create or replace function public.dev_add_bots(p_room uuid) returns int
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
  -- AUTH-02: bots are the only guest accounts still created.
  perform set_config('botc.allow_guest_account', 'on', true);
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
  perform set_config('botc.allow_guest_account', '', true);
  perform private.touch(p_room);
  return added;
end $$;
