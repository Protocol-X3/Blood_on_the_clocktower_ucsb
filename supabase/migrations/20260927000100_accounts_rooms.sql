-- M1 · Accounts & rooms (docs/rules/m1-accounts-rooms.md)
--
-- All writes go through the functions below. Tables allow reads only, through
-- row level security. Functions raise short error codes (e.g. 'SEAT_TAKEN')
-- that the app maps to Chinese messages.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Deployment settings that must not live in the repo, e.g. the admin email (PERM-02).
create table private.app_config (
  key text primary key,
  value text not null
);

create function private.fail(p_code text) returns void
language plpgsql as $$
begin
  raise exception '%', p_code using errcode = 'P0001';
end $$;

-- ───────────────────────────── Profiles ─────────────────────────────

create type public.permission_level as enum ('player', 'dm_eligible', 'admin');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  permission public.permission_level not null default 'player',
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  constraint nickname_length check (nickname is null or char_length(nickname) between 1 and 12),
  constraint nickname_trimmed check (nickname is null or nickname = btrim(nickname)),
  constraint guests_are_players check (not (is_guest and permission <> 'player'))
);
create unique index profiles_nickname_key on public.profiles (lower(nickname));
create unique index profiles_single_admin on public.profiles (permission) where permission = 'admin';

alter table public.profiles enable row level security;
create policy "signed-in users can read profiles" on public.profiles
  for select to authenticated using (true);

create function private.is_admin_email(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_email is not null and exists (
    select 1 from private.app_config where key = 'admin_email' and lower(value) = lower(p_email)
  );
$$;

-- PERM-01 / PERM-02: every new account is a player, except the configured admin.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- AUTH-05: a guest who links a real account stops being a guest and keeps everything else.
create function private.handle_user_upgraded() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(old.is_anonymous, false) and not coalesce(new.is_anonymous, false) then
    update public.profiles set is_guest = false where id = new.id;
    perform private.sync_admin();
  end if;
  return new;
end $$;

-- Grants admin to the account holding the configured admin email, if no admin exists yet.
create function private.sync_admin() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.profiles where permission = 'admin') then
    return;
  end if;
  update public.profiles p set permission = 'admin'
  from auth.users u
  where u.id = p.id and not coalesce(u.is_anonymous, false) and private.is_admin_email(u.email);
end $$;

create trigger on_auth_user_upgraded
  after update of is_anonymous on auth.users
  for each row execute function private.handle_user_upgraded();

create function private.my_permission() returns public.permission_level
language sql stable security definer set search_path = '' as $$
  select permission from public.profiles where id = auth.uid();
$$;

create function private.can_dm(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select permission in ('dm_eligible', 'admin') from public.profiles where id = p_user), false);
$$;

create function private.require_user() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    perform private.fail('NOT_SIGNED_IN');
  end if;
  return auth.uid();
end $$;

-- AUTH-03 / AUTH-04 / PERM-08: users set only their own nickname.
create function public.set_nickname(p_nickname text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v text := btrim(p_nickname);
begin
  perform private.require_user();
  if v is null or char_length(v) < 1 or char_length(v) > 12 then
    perform private.fail('NICKNAME_INVALID');
  end if;
  begin
    update public.profiles set nickname = v where id = auth.uid();
  exception when unique_violation then
    perform private.fail('NICKNAME_TAKEN');
  end;
end $$;

-- PERM-03 / PERM-04 / PERM-05: only the admin grants or revokes DM-eligible.
create function public.set_permission(p_user uuid, p_level public.permission_level) returns void
language plpgsql security definer set search_path = '' as $$
declare
  target public.profiles;
begin
  perform private.require_user();
  if private.my_permission() is distinct from 'admin' or p_level = 'admin' then
    perform private.fail('FORBIDDEN');
  end if;
  select * into target from public.profiles where id = p_user;
  if not found then
    perform private.fail('USER_NOT_FOUND');
  end if;
  if target.permission = 'admin' then
    perform private.fail('FORBIDDEN');
  end if;
  if target.is_guest and p_level <> 'player' then
    perform private.fail('GUEST_NOT_ALLOWED');
  end if;
  update public.profiles set permission = p_level where id = p_user;
end $$;

-- ───────────────────────────── Rooms ─────────────────────────────

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  -- ROOM-02: 4 characters, no look-alikes (0/O, 1/I/L).
  code text not null check (code ~ '^[A-HJKMNP-Z2-9]{4}$'),
  created_by uuid references public.profiles (id) on delete set null,
  dm_id uuid references public.profiles (id) on delete set null,
  seat_count int not null default 10 check (seat_count between 5 and 15),
  status text not null default 'open' check (status in ('open', 'closed')),
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index rooms_open_code on public.rooms (code) where status = 'open';

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat int check (seat between 1 and 15),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat) -- ROOM-06 / ROOM-07: one user per seat
);

create type public.game_status as enum ('setup', 'in_progress', 'ended');

-- Extended in M2/M3. A game in 'setup' or 'in_progress' means "a game is in progress" for room rules.
create table public.games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  dm_id uuid references public.profiles (id) on delete set null,
  status public.game_status not null default 'setup',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create unique index games_one_active_per_room on public.games (room_id) where status <> 'ended';

create function private.is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.room_members where room_id = p_room and user_id = auth.uid());
$$;

create function private.game_active(p_room uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.games where room_id = p_room and status <> 'ended');
$$;

-- ROOM-15: only members see a room, its members and its games.
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.games enable row level security;
create policy "members read their rooms" on public.rooms
  for select to authenticated using (private.is_member(id));
create policy "members read room members" on public.room_members
  for select to authenticated using (private.is_member(room_id));
create policy "members read room games" on public.games
  for select to authenticated using (private.is_member(room_id));

-- ROOM-14: rooms idle for 24 hours close.
create function private.close_stale_rooms() returns void
language sql security definer set search_path = '' as $$
  update public.rooms set status = 'closed', closed_at = now()
  where status = 'open' and last_activity_at < now() - interval '24 hours';
$$;

create function private.touch(p_room uuid) returns void
language sql security definer set search_path = '' as $$
  update public.rooms set last_activity_at = now() where id = p_room;
$$;

create function private.new_room_code() returns text
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := '';
    for i in 1..4 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where code = candidate and status = 'open');
  end loop;
  return candidate;
end $$;

-- Loads an open room the caller belongs to, or fails.
create function private.my_open_room(p_room uuid) returns public.rooms
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms;
begin
  perform private.require_user();
  select * into r from public.rooms where id = p_room and status = 'open';
  if not found then
    perform private.fail('ROOM_NOT_FOUND');
  end if;
  if not private.is_member(p_room) then
    perform private.fail('NOT_MEMBER');
  end if;
  return r;
end $$;

create function private.require_nickname() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select nickname from public.profiles where id = auth.uid()) is null then
    perform private.fail('NICKNAME_REQUIRED');
  end if;
end $$;

-- ROOM-01: DM-eligible users (and the admin) create rooms and start in the DM seat.
create function public.create_room(p_seat_count int default 10) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  new_room public.rooms;
begin
  perform private.require_nickname();
  if not private.can_dm(uid) then
    perform private.fail('FORBIDDEN');
  end if;
  if p_seat_count is null or p_seat_count not between 5 and 15 then
    perform private.fail('SEAT_COUNT_INVALID');
  end if;
  perform private.close_stale_rooms();
  insert into public.rooms (code, created_by, dm_id, seat_count)
  values (private.new_room_code(), uid, uid, p_seat_count)
  returning * into new_room;
  insert into public.room_members (room_id, user_id) values (new_room.id, uid);
  return new_room.code;
end $$;

-- ROOM-03 / ROOM-04: any signed-in user with a nickname joins an open room by code.
create function public.join_room(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  room_id uuid;
begin
  perform private.require_nickname();
  perform private.close_stale_rooms();
  select id into room_id from public.rooms where code = upper(btrim(p_code)) and status = 'open';
  if room_id is null then
    perform private.fail('ROOM_NOT_FOUND');
  end if;
  insert into public.room_members (room_id, user_id) values (room_id, uid) on conflict do nothing;
  perform private.touch(room_id);
  return room_id;
end $$;

-- ROOM-06 / ROOM-07: take (or move to) an empty seat between games.
create function public.take_seat(p_room uuid, p_seat int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms := private.my_open_room(p_room);
begin
  if private.game_active(p_room) then
    perform private.fail('GAME_IN_PROGRESS');
  end if;
  if r.dm_id = auth.uid() then
    perform private.fail('IS_DM');
  end if;
  if p_seat is null or p_seat not between 1 and r.seat_count then
    perform private.fail('SEAT_INVALID');
  end if;
  begin
    update public.room_members set seat = p_seat where room_id = p_room and user_id = auth.uid();
  exception when unique_violation then
    perform private.fail('SEAT_TAKEN');
  end;
  perform private.touch(p_room);
end $$;

create function public.leave_seat(p_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.my_open_room(p_room);
  if private.game_active(p_room) then
    perform private.fail('GAME_IN_PROGRESS');
  end if;
  update public.room_members set seat = null where room_id = p_room and user_id = auth.uid();
  perform private.touch(p_room);
end $$;

create function public.leave_room(p_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms := private.my_open_room(p_room);
  my_seat int;
begin
  select seat into my_seat from public.room_members where room_id = p_room and user_id = auth.uid();
  if private.game_active(p_room) and (r.dm_id = auth.uid() or my_seat is not null) then
    perform private.fail('GAME_IN_PROGRESS');
  end if;
  if r.dm_id = auth.uid() then
    update public.rooms set dm_id = null where id = p_room;
  end if;
  delete from public.room_members where room_id = p_room and user_id = auth.uid();
  perform private.touch(p_room);
end $$;

create function private.require_room_dm(p_room uuid) returns public.rooms
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms := private.my_open_room(p_room);
begin
  if r.dm_id is distinct from auth.uid() then
    perform private.fail('NOT_DM');
  end if;
  return r;
end $$;

-- ROOM-05 / ROOM-12
create function public.set_seat_count(p_room uuid, p_count int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_room_dm(p_room);
  if private.game_active(p_room) then
    perform private.fail('GAME_IN_PROGRESS');
  end if;
  if p_count is null or p_count not between 5 and 15 then
    perform private.fail('SEAT_COUNT_INVALID');
  end if;
  if p_count < coalesce((select max(seat) from public.room_members where room_id = p_room), 0) then
    perform private.fail('SEAT_COUNT_TOO_LOW');
  end if;
  update public.rooms set seat_count = p_count where id = p_room;
  perform private.touch(p_room);
end $$;

-- ROOM-08: the DM moves, unseats or removes players between games.
create function public.dm_move_player(p_room uuid, p_user uuid, p_seat int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms := private.require_room_dm(p_room);
begin
  if private.game_active(p_room) then
    perform private.fail('GAME_IN_PROGRESS');
  end if;
  if p_user = r.dm_id then
    perform private.fail('IS_DM');
  end if;
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = p_user) then
    perform private.fail('NOT_MEMBER');
  end if;
  if p_seat is null or p_seat not between 1 and r.seat_count then
    perform private.fail('SEAT_INVALID');
  end if;
  begin
    update public.room_members set seat = p_seat where room_id = p_room and user_id = p_user;
  exception when unique_violation then
    perform private.fail('SEAT_TAKEN');
  end;
  perform private.touch(p_room);
end $$;

create function public.dm_unseat(p_room uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_room_dm(p_room);
  if private.game_active(p_room) then
    perform private.fail('GAME_IN_PROGRESS');
  end if;
  update public.room_members set seat = null where room_id = p_room and user_id = p_user;
  perform private.touch(p_room);
end $$;

create function public.dm_kick(p_room uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_room_dm(p_room);
  if private.game_active(p_room) then
    perform private.fail('GAME_IN_PROGRESS');
  end if;
  if p_user = auth.uid() then
    perform private.fail('IS_DM');
  end if;
  delete from public.room_members where room_id = p_room and user_id = p_user;
  perform private.touch(p_room);
end $$;

-- ROOM-09: only DM-eligible members take the empty DM seat; it replaces their player seat.
create function public.take_dm_seat(p_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms := private.my_open_room(p_room);
  active boolean := private.game_active(p_room);
begin
  if not private.can_dm(auth.uid()) then
    perform private.fail('FORBIDDEN');
  end if;
  if r.dm_id is not null then
    perform private.fail('DM_SEAT_TAKEN');
  end if;
  if active and exists (select 1 from public.room_members where room_id = p_room and user_id = auth.uid() and seat is not null) then
    perform private.fail('IS_SEATED');
  end if;
  update public.room_members set seat = null where room_id = p_room and user_id = auth.uid();
  update public.rooms set dm_id = auth.uid() where id = p_room;
  update public.games set dm_id = auth.uid() where room_id = p_room and status <> 'ended';
  perform private.touch(p_room);
end $$;

-- ROOM-10: the DM leaves the DM seat only between games.
create function public.leave_dm_seat(p_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_room_dm(p_room);
  if private.game_active(p_room) then
    perform private.fail('GAME_IN_PROGRESS');
  end if;
  update public.rooms set dm_id = null where id = p_room;
  perform private.touch(p_room);
end $$;

-- ROOM-11: the admin can hand the DM seat to another DM-eligible member at any time.
create function public.admin_assign_dm(p_room uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  active boolean;
begin
  perform private.require_user();
  if private.my_permission() is distinct from 'admin' then
    perform private.fail('FORBIDDEN');
  end if;
  if not exists (select 1 from public.rooms where id = p_room and status = 'open') then
    perform private.fail('ROOM_NOT_FOUND');
  end if;
  if not exists (select 1 from public.room_members where room_id = p_room and user_id = p_user) then
    perform private.fail('NOT_MEMBER');
  end if;
  if not private.can_dm(p_user) then
    perform private.fail('TARGET_NOT_DM_ELIGIBLE');
  end if;
  active := private.game_active(p_room);
  if active and exists (select 1 from public.room_members where room_id = p_room and user_id = p_user and seat is not null) then
    perform private.fail('TARGET_SEATED');
  end if;
  update public.room_members set seat = null where room_id = p_room and user_id = p_user;
  update public.rooms set dm_id = p_user where id = p_room;
  update public.games set dm_id = p_user where room_id = p_room and status <> 'ended';
  perform private.touch(p_room);
end $$;

-- ROOM-14: the creator or the admin closes a room; its games stay in history.
create function public.close_room(p_room uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms;
begin
  perform private.require_user();
  select * into r from public.rooms where id = p_room and status = 'open';
  if not found then
    perform private.fail('ROOM_NOT_FOUND');
  end if;
  if r.created_by is distinct from auth.uid() and private.my_permission() is distinct from 'admin' then
    perform private.fail('FORBIDDEN');
  end if;
  update public.rooms set status = 'closed', closed_at = now() where id = p_room;
end $$;

-- ───────────────────────────── Access ─────────────────────────────

-- Signed-out visitors can call nothing; signed-in users call only the public functions.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;
-- Row level security policies run as the caller, so they need the membership check.
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid) to authenticated;

-- ROOM-13: live updates for room screens.
alter publication supabase_realtime add table public.rooms, public.room_members, public.games;
