-- M2 · Setup wizard, card draw and role secrecy (docs/rules/m2-setup-roles.md: SETUP, DRAW, SECRET)
--
-- Secrecy is enforced by where data lives:
--   seat_roles         actual role, shown role, alignment (the DM only, until the game ends)
--   seat_shown_roles   each player's own shown role (that player and the DM)
--   game_composition   which roles are in play (the DM only, until the game ends)
--   draw_cards         which role is on which card (the DM only)
--   draw_slots         only which cards are taken, and by which seat (the whole room)

create type public.assignment_mode as enum ('manual', 'draw');

alter table public.games
  add column script_id uuid references public.scripts (id) on delete set null,
  add column assignment_mode public.assignment_mode,
  add column seat_count int check (seat_count between 5 and 15),
  add column phase_kind text check (phase_kind in ('night', 'day')),
  add column phase_number int check (phase_number >= 1),
  add column started_at timestamptz;

-- SCRIPT-06: each game keeps its own copy of the script's roles.
create table public.game_roles (
  game_id uuid not null references public.games (id) on delete cascade,
  role_id text not null,
  name text not null,
  team public.team not null,
  ability text not null,
  glyph text not null,
  reminders text[] not null default '{}',
  primary key (game_id, role_id)
);

create table public.game_composition (
  game_id uuid not null references public.games (id) on delete cascade,
  role_id text not null,
  shown_role_id text not null,
  primary key (game_id, role_id),
  foreign key (game_id, role_id) references public.game_roles (game_id, role_id),
  foreign key (game_id, shown_role_id) references public.game_roles (game_id, role_id)
);

create table public.seat_roles (
  game_id uuid not null references public.games (id) on delete cascade,
  seat int not null check (seat between 1 and 15),
  actual_role_id text not null,
  shown_role_id text not null,
  alignment public.alignment not null,
  primary key (game_id, seat),
  unique (game_id, actual_role_id),
  foreign key (game_id, actual_role_id) references public.game_roles (game_id, role_id),
  foreign key (game_id, shown_role_id) references public.game_roles (game_id, role_id)
);

create table public.seat_shown_roles (
  game_id uuid not null references public.games (id) on delete cascade,
  seat int not null check (seat between 1 and 15),
  user_id uuid not null references public.profiles (id) on delete cascade,
  shown_role_id text not null,
  primary key (game_id, seat),
  foreign key (game_id, shown_role_id) references public.game_roles (game_id, role_id)
);

create table public.draw_cards (
  game_id uuid not null references public.games (id) on delete cascade,
  card_no int not null check (card_no between 1 and 15),
  role_id text not null,
  shown_role_id text not null,
  primary key (game_id, card_no)
);

create table public.draw_slots (
  game_id uuid not null references public.games (id) on delete cascade,
  card_no int not null check (card_no between 1 and 15),
  taken_by_seat int check (taken_by_seat between 1 and 15),
  primary key (game_id, card_no),
  unique (game_id, taken_by_seat) -- DRAW-02: one card per seat
);

-- The public per-seat state of a started game (extended in M3: deaths, votes…).
create table public.game_seats (
  game_id uuid not null references public.games (id) on delete cascade,
  seat int not null check (seat between 1 and 15),
  user_id uuid references public.profiles (id) on delete set null,
  alive boolean not null default true,
  primary key (game_id, seat)
);

-- ───────────────────────────── Visibility ─────────────────────────────

create function private.is_game_member(p_game uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.games g join public.room_members m on m.room_id = g.room_id
    where g.id = p_game and m.user_id = auth.uid()
  );
$$;

create function private.is_game_dm(p_game uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.games where id = p_game and dm_id = auth.uid());
$$;

-- SECRET-02 / SECRET-03: the DM always; the players and DM of an ended game afterwards.
create function private.can_see_secrets(p_game uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_game_dm(p_game) or exists (
    select 1 from public.games g
    where g.id = p_game and g.status = 'ended'
      and (g.dm_id = auth.uid() or exists (select 1 from public.game_seats s where s.game_id = g.id and s.user_id = auth.uid()))
  );
$$;

alter table public.game_roles enable row level security;
alter table public.game_composition enable row level security;
alter table public.seat_roles enable row level security;
alter table public.seat_shown_roles enable row level security;
alter table public.draw_cards enable row level security;
alter table public.draw_slots enable row level security;
alter table public.game_seats enable row level security;

create policy "room members read the game's script" on public.game_roles
  for select to authenticated using (private.is_game_member(game_id));
create policy "DM reads the composition" on public.game_composition
  for select to authenticated using (private.can_see_secrets(game_id));
create policy "DM reads seat roles" on public.seat_roles
  for select to authenticated using (private.can_see_secrets(game_id));
-- SECRET-01: a player sees only their own shown role.
create policy "players read their own shown role" on public.seat_shown_roles
  for select to authenticated using (user_id = auth.uid() or private.can_see_secrets(game_id));
create policy "DM reads the cards" on public.draw_cards
  for select to authenticated using (private.is_game_dm(game_id));
create policy "room members see which cards are taken" on public.draw_slots
  for select to authenticated using (private.is_game_member(game_id));
create policy "room members read game seats" on public.game_seats
  for select to authenticated using (private.is_game_member(game_id));

grant execute on function private.is_game_member(uuid), private.is_game_dm(uuid), private.can_see_secrets(uuid) to authenticated;

-- ───────────────────────────── Setup ─────────────────────────────

create function private.setup_game_as_dm(p_game uuid) returns public.games
language plpgsql security definer set search_path = '' as $$
declare
  g public.games;
begin
  perform private.require_user();
  select * into g from public.games where id = p_game;
  if not found then
    perform private.fail('GAME_NOT_FOUND');
  end if;
  if g.dm_id is distinct from auth.uid() then
    perform private.fail('NOT_DM');
  end if;
  if g.status <> 'setup' then
    perform private.fail('NOT_IN_SETUP');
  end if;
  return g;
end $$;

-- SETUP-05 / SETUP-06: the room's DM starts setup with a script and an assignment mode.
create function public.start_setup(p_room uuid, p_script uuid, p_mode public.assignment_mode) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r public.rooms := private.require_room_dm(p_room);
  new_game uuid;
begin
  if private.game_active(p_room) then
    perform private.fail('GAME_IN_PROGRESS');
  end if;
  if p_mode is null then
    perform private.fail('MODE_REQUIRED');
  end if;
  if not exists (select 1 from public.scripts where id = p_script) then
    perform private.fail('SCRIPT_NOT_FOUND');
  end if;
  insert into public.games (room_id, dm_id, status, script_id, assignment_mode, seat_count)
  values (p_room, r.dm_id, 'setup', p_script, p_mode, r.seat_count)
  returning id into new_game;
  insert into public.game_roles (game_id, role_id, name, team, ability, glyph, reminders)
  select new_game, ro.id, ro.name, ro.team, ro.ability, coalesce(ro.glyph, left(ro.name, 1)), ro.reminders
  from public.script_roles sr join public.roles ro on ro.id = sr.role_id
  where sr.script_id = p_script;
  perform private.touch(p_room);
  return new_game;
end $$;

-- SETUP-06: going back to the basics step discards the setup.
create function public.cancel_setup(p_game uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.setup_game_as_dm(p_game);
begin
  delete from public.games where id = g.id;
  perform private.touch(g.room_id);
end $$;

-- SETUP-07 / SETUP-08: exactly one role per seat, from the script, none twice, each with a shown role.
-- p_roles: [{"role": "drunk", "shown": "chef"}, …]. Replacing it clears assignments and draws.
create function public.set_composition(p_game uuid, p_roles jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.setup_game_as_dm(p_game);
  n int;
begin
  if p_roles is null or jsonb_typeof(p_roles) <> 'array' then
    perform private.fail('COMPOSITION_INVALID');
  end if;
  n := jsonb_array_length(p_roles);
  if n <> g.seat_count then
    perform private.fail('COMPOSITION_SIZE');
  end if;
  if (select count(distinct e ->> 'role') from jsonb_array_elements(p_roles) e) <> n then
    perform private.fail('COMPOSITION_DUPLICATE');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_roles) e
    where not exists (select 1 from public.game_roles where game_id = g.id and role_id = e ->> 'role')
       or not exists (select 1 from public.game_roles where game_id = g.id and role_id = coalesce(e ->> 'shown', e ->> 'role'))
  ) then
    perform private.fail('ROLE_NOT_IN_SCRIPT');
  end if;
  delete from public.draw_slots where game_id = g.id;
  delete from public.draw_cards where game_id = g.id;
  delete from public.seat_shown_roles where game_id = g.id;
  delete from public.seat_roles where game_id = g.id;
  delete from public.game_composition where game_id = g.id;
  insert into public.game_composition (game_id, role_id, shown_role_id)
  select g.id, e ->> 'role', coalesce(e ->> 'shown', e ->> 'role') from jsonb_array_elements(p_roles) e;
  perform private.touch(g.room_id);
end $$;

create function private.seat_holder(p_room uuid, p_seat int) returns uuid
language sql stable security definer set search_path = '' as $$
  select user_id from public.room_members where room_id = p_room and seat = p_seat;
$$;

-- SETUP-09: in manual mode the DM gives each seat one role from the composition.
create function public.assign_seat(p_game uuid, p_seat int, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.setup_game_as_dm(p_game);
  comp public.game_composition;
begin
  if g.assignment_mode <> 'manual' then
    perform private.fail('WRONG_MODE');
  end if;
  if p_seat is null or p_seat not between 1 and g.seat_count then
    perform private.fail('SEAT_INVALID');
  end if;
  if private.seat_holder(g.room_id, p_seat) is null then
    perform private.fail('SEAT_EMPTY');
  end if;
  select * into comp from public.game_composition where game_id = g.id and role_id = p_role;
  if not found then
    perform private.fail('ROLE_NOT_IN_COMPOSITION');
  end if;
  if exists (select 1 from public.seat_roles where game_id = g.id and actual_role_id = p_role and seat <> p_seat) then
    perform private.fail('ROLE_ALREADY_ASSIGNED');
  end if;
  insert into public.seat_roles (game_id, seat, actual_role_id, shown_role_id, alignment)
  select g.id, p_seat, comp.role_id, comp.shown_role_id,
         case when gr.team in ('townsfolk', 'outsider') then 'good'::public.alignment else 'evil'::public.alignment end
  from public.game_roles gr where gr.game_id = g.id and gr.role_id = comp.role_id
  on conflict (game_id, seat) do update set
    actual_role_id = excluded.actual_role_id, shown_role_id = excluded.shown_role_id, alignment = excluded.alignment;
  perform private.touch(g.room_id);
end $$;

create function public.unassign_seat(p_game uuid, p_seat int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.setup_game_as_dm(p_game);
begin
  delete from public.seat_roles where game_id = g.id and seat = p_seat;
  perform private.touch(g.room_id);
end $$;

-- DRAW-01 / DRAW-06: the server deals the composition onto face-down cards in random order.
-- Calling it again resets every draw.
create function public.shuffle_cards(p_game uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.setup_game_as_dm(p_game);
begin
  if g.assignment_mode <> 'draw' then
    perform private.fail('WRONG_MODE');
  end if;
  if (select count(*) from public.game_composition where game_id = g.id) <> g.seat_count then
    perform private.fail('COMPOSITION_INCOMPLETE');
  end if;
  delete from public.draw_slots where game_id = g.id;
  delete from public.draw_cards where game_id = g.id;
  delete from public.seat_shown_roles where game_id = g.id;
  delete from public.seat_roles where game_id = g.id;
  insert into public.draw_cards (game_id, card_no, role_id, shown_role_id)
  select g.id, row_number() over (order by gen_random_uuid()), role_id, shown_role_id
  from public.game_composition where game_id = g.id;
  insert into public.draw_slots (game_id, card_no) select g.id, card_no from public.draw_cards where game_id = g.id;
  perform private.touch(g.room_id);
end $$;

-- DRAW-02 / DRAW-03 / DRAW-04: a seated player draws one card. The first tap wins;
-- the player can read their shown role at once.
create function public.draw_card(p_game uuid, p_card int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  g public.games;
  my_seat int;
  card public.draw_cards;
begin
  select * into g from public.games where id = p_game;
  if not found or not private.is_game_member(p_game) then
    perform private.fail('GAME_NOT_FOUND');
  end if;
  if g.status <> 'setup' then
    perform private.fail('NOT_IN_SETUP');
  end if;
  if g.assignment_mode <> 'draw' then
    perform private.fail('WRONG_MODE');
  end if;
  select seat into my_seat from public.room_members where room_id = g.room_id and user_id = uid;
  if my_seat is null then
    perform private.fail('NOT_SEATED');
  end if;
  if not exists (select 1 from public.draw_slots where game_id = p_game) then
    perform private.fail('NOT_SHUFFLED');
  end if;
  if exists (select 1 from public.draw_slots where game_id = p_game and taken_by_seat = my_seat) then
    perform private.fail('ALREADY_DRAWN');
  end if;
  begin
    update public.draw_slots set taken_by_seat = my_seat
    where game_id = p_game and card_no = p_card and taken_by_seat is null;
    if not found then
      perform private.fail(case when exists (select 1 from public.draw_slots where game_id = p_game and card_no = p_card)
                                then 'CARD_TAKEN' else 'CARD_INVALID' end);
    end if;
  exception when unique_violation then
    perform private.fail('ALREADY_DRAWN');
  end;
  select * into card from public.draw_cards where game_id = p_game and card_no = p_card;
  insert into public.seat_roles (game_id, seat, actual_role_id, shown_role_id, alignment)
  select p_game, my_seat, card.role_id, card.shown_role_id,
         case when gr.team in ('townsfolk', 'outsider') then 'good'::public.alignment else 'evil'::public.alignment end
  from public.game_roles gr where gr.game_id = p_game and gr.role_id = card.role_id;
  insert into public.seat_shown_roles (game_id, seat, user_id, shown_role_id) values (p_game, my_seat, uid, card.shown_role_id);
  perform private.touch(g.room_id);
end $$;

-- SETUP-10: the game starts only with every seat filled and assigned; everyone's role
-- card appears at once, and the first night begins.
create function public.start_game(p_game uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.setup_game_as_dm(p_game);
begin
  if (select count(*) from public.room_members where room_id = g.room_id and seat between 1 and g.seat_count) <> g.seat_count then
    perform private.fail('NOT_ALL_SEATED');
  end if;
  if (select count(*) from public.seat_roles where game_id = g.id and seat between 1 and g.seat_count) <> g.seat_count then
    perform private.fail('NOT_ALL_ASSIGNED');
  end if;
  insert into public.game_seats (game_id, seat, user_id)
  select g.id, seat, user_id from public.room_members where room_id = g.room_id and seat between 1 and g.seat_count;
  insert into public.seat_shown_roles (game_id, seat, user_id, shown_role_id)
  select g.id, sr.seat, m.user_id, sr.shown_role_id
  from public.seat_roles sr join public.room_members m on m.room_id = g.room_id and m.seat = sr.seat
  where sr.game_id = g.id
  on conflict (game_id, seat) do nothing;
  update public.games set status = 'in_progress', phase_kind = 'night', phase_number = 1, started_at = now() where id = g.id;
  perform private.touch(g.room_id);
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(uuid), private.is_game_member(uuid), private.is_game_dm(uuid), private.can_see_secrets(uuid) to authenticated;

alter publication supabase_realtime add table
  public.game_composition, public.seat_roles, public.seat_shown_roles, public.draw_slots, public.game_seats;
