-- M3 · Live game (docs/rules/m3-live-game.md: PHASE, DEATH, NOM, VOTE, BOARD, END)
--
-- Everything here is public to the room (players see deaths, nominations, hands and
-- the board), except the final roles, which stay in seat_roles (SECRET-03).

create type public.death_cause as enum ('executed', 'night', 'other');
create type public.nomination_status as enum ('open', 'voting', 'counted', 'closed', 'cancelled');

alter table public.games
  add column winner public.alignment,
  -- VOTE-05: how fast the clock hand moves, per seat.
  add column vote_speed_ms int not null default 1500 check (vote_speed_ms between 500 and 3000);

-- DEATH-01 / DEATH-04: the public state of each seat.
alter table public.game_seats
  add column death_cause public.death_cause,
  add column death_note text,
  add column ghost_vote_used boolean not null default false,
  add constraint death_cause_only_when_dead check (alive = (death_cause is null));

-- STATS-04 (M5) uses the role a seat held when the game started.
alter table public.seat_roles add column starting_role_id text;

-- Every death, for the summary and history (END-03).
create table public.game_deaths (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  seat int not null check (seat between 1 and 15),
  cause public.death_cause not null,
  note text,
  phase_kind text not null check (phase_kind in ('night', 'day')),
  phase_number int not null,
  revived boolean not null default false,
  created_at timestamptz not null default now()
);
create index game_deaths_game on public.game_deaths (game_id);

create table public.nominations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  day_number int not null,
  nominator_seat int not null check (nominator_seat between 1 and 15),
  nominee_seat int not null check (nominee_seat between 1 and 15),
  status public.nomination_status not null default 'open',
  -- VOTE-03 / VOTE-04: how many seats of the circle the clock hand has passed.
  hand_index int not null default 0 check (hand_index between 0 and 15),
  paused boolean not null default false,
  -- VOTE-10: fixed when the circle starts.
  threshold int,
  -- VOTE-09: set when the circle completes, and kept in step with corrections.
  vote_count int,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index nominations_game on public.nominations (game_id);
-- NOM-01: one open nomination at a time.
create unique index nominations_one_open on public.nominations (game_id) where status in ('open', 'voting', 'counted');

create table public.votes (
  nomination_id uuid not null references public.nominations (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  seat int not null check (seat between 1 and 15),
  raised boolean not null default false,
  locked boolean not null default false,
  -- VOTE-07 / VOTE-08: this locked vote spent the seat's ghost vote.
  ghost_spent boolean not null default false,
  primary key (nomination_id, seat)
);
create index votes_game on public.votes (game_id);

-- VOTE-14: each day ends with an execution or 无人处决.
create table public.day_results (
  game_id uuid not null references public.games (id) on delete cascade,
  day_number int not null,
  executed_seat int check (executed_seat between 1 and 15),
  created_at timestamptz not null default now(),
  primary key (game_id, day_number)
);

-- BOARD-01 / BOARD-02
create table public.board_posts (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  seat int check (seat between 1 and 15),
  is_dm boolean not null default false,
  body text not null check (char_length(body) between 1 and 140),
  phase_kind text not null check (phase_kind in ('night', 'day')),
  phase_number int not null,
  created_at timestamptz not null default now()
);
create index board_posts_game on public.board_posts (game_id, created_at desc);

alter table public.game_deaths enable row level security;
alter table public.nominations enable row level security;
alter table public.votes enable row level security;
alter table public.day_results enable row level security;
alter table public.board_posts enable row level security;

-- Public to the room (BOARD-04: and to nobody else).
create policy "room members read deaths" on public.game_deaths
  for select to authenticated using (private.is_game_member(game_id));
create policy "room members read nominations" on public.nominations
  for select to authenticated using (private.is_game_member(game_id));
create policy "room members read votes" on public.votes
  for select to authenticated using (private.is_game_member(game_id));
create policy "room members read day results" on public.day_results
  for select to authenticated using (private.is_game_member(game_id));
create policy "room members read the board" on public.board_posts
  for select to authenticated using (private.is_game_member(game_id));

-- ───────────────────────────── Helpers ─────────────────────────────

-- A running game whose DM is the caller.
create function private.running_game_as_dm(p_game uuid) returns public.games
language plpgsql security definer set search_path = '' as $$
declare
  g public.games;
begin
  perform private.require_user();
  select * into g from public.games where id = p_game;
  if not found or not private.is_game_member(p_game) then
    perform private.fail('GAME_NOT_FOUND');
  end if;
  if g.dm_id is distinct from auth.uid() then
    perform private.fail('NOT_DM');
  end if;
  if g.status <> 'in_progress' then
    perform private.fail('NOT_IN_PROGRESS');
  end if;
  return g;
end $$;

create function private.game_seat(p_game uuid, p_seat int) returns public.game_seats
language plpgsql security definer set search_path = '' as $$
declare
  s public.game_seats;
begin
  select * into s from public.game_seats where game_id = p_game and seat = p_seat;
  if not found then
    perform private.fail('SEAT_INVALID');
  end if;
  return s;
end $$;

-- A nomination of a running game whose DM is the caller.
create function private.nomination_as_dm(p_nomination uuid) returns public.nominations
language plpgsql security definer set search_path = '' as $$
declare
  n public.nominations;
begin
  perform private.require_user();
  select * into n from public.nominations where id = p_nomination;
  if not found or not private.is_game_member(n.game_id) then
    perform private.fail('NOMINATION_NOT_FOUND');
  end if;
  perform private.running_game_as_dm(n.game_id);
  return n;
end $$;

create function private.open_nomination_of(p_game uuid) returns public.nominations
language sql stable security definer set search_path = '' as $$
  select * from public.nominations where game_id = p_game and status in ('open', 'voting', 'counted');
$$;

-- VOTE-11: the day's highest count at or above its threshold; a tie between nominees means nobody.
create function private.on_the_block(p_game uuid, p_day int) returns int
language sql stable security definer set search_path = '' as $$
  with passed as (
    select nominee_seat, vote_count from public.nominations
    where game_id = p_game and day_number = p_day and status = 'closed' and vote_count >= threshold
  ), top as (
    select nominee_seat from passed where vote_count = (select max(vote_count) from passed)
  )
  select case when (select count(distinct nominee_seat) from top) = 1 then (select min(nominee_seat) from top) end;
$$;

-- ───────────────────────────── Phases ─────────────────────────────

-- PHASE-01 / PHASE-02 / PHASE-04: night N → day N → night N+1, only forward, only by the DM.
create function public.advance_phase(p_game uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
begin
  if (private.open_nomination_of(g.id)).id is not null then
    perform private.fail('NOMINATION_OPEN');
  end if;
  update public.games set
    phase_kind = case when g.phase_kind = 'night' then 'day' else 'night' end,
    phase_number = case when g.phase_kind = 'night' then g.phase_number else g.phase_number + 1 end
  where id = g.id;
  perform private.touch(g.room_id);
end $$;

-- ───────────────────────────── Deaths ─────────────────────────────

create function private.kill(g public.games, p_seat int, p_cause public.death_cause, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.game_seats set alive = false, death_cause = p_cause, death_note = p_note
  where game_id = g.id and seat = p_seat;
  insert into public.game_deaths (game_id, seat, cause, note, phase_kind, phase_number)
  values (g.id, p_seat, p_cause, p_note, g.phase_kind, g.phase_number);
end $$;

-- DEATH-01: the DM marks a living player dead, with a public cause.
create function public.kill_seat(p_game uuid, p_seat int, p_cause public.death_cause, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
  s public.game_seats := private.game_seat(p_game, p_seat);
  note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_cause is null then
    perform private.fail('CAUSE_REQUIRED');
  end if;
  if char_length(note) > 40 then
    perform private.fail('NOTE_TOO_LONG');
  end if;
  if not s.alive then
    perform private.fail('ALREADY_DEAD');
  end if;
  perform private.kill(g, p_seat, p_cause, note);
  perform private.touch(g.room_id);
end $$;

-- DEATH-02: revive; the ghost vote keeps its state.
create function public.revive_seat(p_game uuid, p_seat int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
  s public.game_seats := private.game_seat(p_game, p_seat);
begin
  if s.alive then
    perform private.fail('NOT_DEAD');
  end if;
  update public.game_seats set alive = true, death_cause = null, death_note = null where game_id = g.id and seat = p_seat;
  update public.game_deaths set revived = true
  where id = (select max(id) from public.game_deaths where game_id = g.id and seat = p_seat);
  perform private.touch(g.room_id);
end $$;

-- DEATH-04: the DM marks a ghost vote used or unused.
create function public.set_ghost_vote(p_game uuid, p_seat int, p_used boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
begin
  perform private.game_seat(p_game, p_seat);
  if p_used is null then
    perform private.fail('INVALID');
  end if;
  update public.game_seats set ghost_vote_used = p_used where game_id = g.id and seat = p_seat;
  perform private.touch(g.room_id);
end $$;

-- ───────────────────────────── Nominations ─────────────────────────────

-- NOM-01 / PHASE-05: the DM opens a nomination during the day. Rule breaks are only warned about (NOM-02, in the app).
create function public.open_nomination(p_game uuid, p_nominator int, p_nominee int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
  new_id uuid;
begin
  if g.phase_kind <> 'day' then
    perform private.fail('NOT_DAY');
  end if;
  perform private.game_seat(p_game, p_nominator);
  perform private.game_seat(p_game, p_nominee);
  if exists (select 1 from public.day_results where game_id = g.id and day_number = g.phase_number) then
    perform private.fail('DAY_OVER');
  end if;
  if (private.open_nomination_of(g.id)).id is not null then
    perform private.fail('NOMINATION_OPEN');
  end if;
  insert into public.nominations (game_id, day_number, nominator_seat, nominee_seat)
  values (g.id, g.phase_number, p_nominator, p_nominee)
  returning id into new_id;
  insert into public.votes (nomination_id, game_id, seat)
  select new_id, g.id, seat from public.game_seats where game_id = g.id;
  perform private.touch(g.room_id);
  return new_id;
end $$;

-- NOM-03: cancel before the circle starts.
create function public.cancel_nomination(p_nomination uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n public.nominations := private.nomination_as_dm(p_nomination);
begin
  if n.status <> 'open' then
    perform private.fail('VOTE_STARTED');
  end if;
  update public.nominations set status = 'cancelled', closed_at = now() where id = n.id;
end $$;

-- VOTE-01 / VOTE-02 / VOTE-04: a seated player raises or lowers their own hand until the clock hand passes them.
create function public.set_hand(p_nomination uuid, p_raised boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  n public.nominations;
  s public.game_seats;
  v public.votes;
begin
  select * into n from public.nominations where id = p_nomination;
  if not found or not private.is_game_member(n.game_id) then
    perform private.fail('NOMINATION_NOT_FOUND');
  end if;
  if p_raised is null then
    perform private.fail('INVALID');
  end if;
  select * into s from public.game_seats where game_id = n.game_id and user_id = uid;
  if not found then
    perform private.fail('NOT_SEATED');
  end if;
  if n.status not in ('open', 'voting') then
    perform private.fail('NO_OPEN_VOTE');
  end if;
  select * into v from public.votes where nomination_id = n.id and seat = s.seat for update;
  if v.locked then
    perform private.fail('VOTE_LOCKED');
  end if;
  if p_raised and not s.alive and s.ghost_vote_used then
    perform private.fail('GHOST_VOTE_SPENT');
  end if;
  update public.votes set raised = p_raised where nomination_id = n.id and seat = s.seat;
end $$;

-- VOTE-03: the DM starts the circle; the threshold is fixed now (VOTE-10).
create function public.start_vote(p_nomination uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n public.nominations := private.nomination_as_dm(p_nomination);
begin
  if n.status <> 'open' then
    perform private.fail('VOTE_STARTED');
  end if;
  update public.nominations set status = 'voting', hand_index = 0, paused = false,
    threshold = ceil((select count(*) from public.game_seats where game_id = n.game_id and alive) / 2.0)::int
  where id = n.id;
end $$;

-- VOTE-04 / VOTE-07: the clock hand passes the next seat and locks its vote. The DM's
-- client calls this every tick (VOTE-05) or on 下一位 (VOTE-06). p_expected is the hand
-- position the caller saw, so a repeated tick changes nothing. Returns the new position.
create function public.advance_vote(p_nomination uuid, p_expected int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n public.nominations := private.nomination_as_dm(p_nomination);
  seat_count int;
  target int;
  s public.game_seats;
  v public.votes;
  lock_raised boolean;
begin
  select * into n from public.nominations where id = n.id for update;
  if n.status <> 'voting' then
    perform private.fail('NOT_VOTING');
  end if;
  if p_expected is distinct from n.hand_index then
    return n.hand_index;
  end if;
  select count(*) into seat_count from public.game_seats where game_id = n.game_id;
  target := ((n.nominee_seat + n.hand_index) % seat_count) + 1;
  s := private.game_seat(n.game_id, target);
  select * into v from public.votes where nomination_id = n.id and seat = target for update;
  -- A dead player's raised hand counts only with an unused ghost vote, which it spends.
  lock_raised := v.raised and (s.alive or not s.ghost_vote_used);
  update public.votes set locked = true, raised = lock_raised, ghost_spent = lock_raised and not s.alive
  where nomination_id = n.id and seat = target;
  if lock_raised and not s.alive then
    update public.game_seats set ghost_vote_used = true where game_id = n.game_id and seat = target;
  end if;
  if n.hand_index + 1 = seat_count then
    update public.nominations set hand_index = seat_count, status = 'counted', paused = false,
      vote_count = (select count(*) from public.votes where nomination_id = n.id and locked and raised)
    where id = n.id;
  else
    update public.nominations set hand_index = n.hand_index + 1 where id = n.id;
  end if;
  return n.hand_index + 1;
end $$;

-- VOTE-06: pause or resume the clock hand.
create function public.set_vote_paused(p_nomination uuid, p_paused boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n public.nominations := private.nomination_as_dm(p_nomination);
begin
  if n.status <> 'voting' then
    perform private.fail('NOT_VOTING');
  end if;
  update public.nominations set paused = coalesce(p_paused, false) where id = n.id;
end $$;

-- VOTE-05
create function public.set_vote_speed(p_game uuid, p_ms int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
begin
  if p_ms is null or p_ms not between 500 and 3000 then
    perform private.fail('SPEED_INVALID');
  end if;
  update public.games set vote_speed_ms = p_ms where id = g.id;
end $$;

-- VOTE-08: before closing, the DM corrects a locked vote; the ghost vote follows.
create function public.correct_vote(p_nomination uuid, p_seat int, p_raised boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n public.nominations := private.nomination_as_dm(p_nomination);
  s public.game_seats;
  v public.votes;
begin
  if n.status not in ('voting', 'counted') then
    perform private.fail('NOT_VOTING');
  end if;
  if p_raised is null then
    perform private.fail('INVALID');
  end if;
  s := private.game_seat(n.game_id, p_seat);
  select * into v from public.votes where nomination_id = n.id and seat = p_seat for update;
  if not v.locked then
    perform private.fail('NOT_LOCKED');
  end if;
  if v.raised = p_raised then
    return;
  end if;
  if p_raised and not s.alive then
    update public.votes set raised = true, ghost_spent = true where nomination_id = n.id and seat = p_seat;
    update public.game_seats set ghost_vote_used = true where game_id = n.game_id and seat = p_seat;
  elsif not p_raised and v.ghost_spent then
    update public.votes set raised = false, ghost_spent = false where nomination_id = n.id and seat = p_seat;
    update public.game_seats set ghost_vote_used = false where game_id = n.game_id and seat = p_seat;
  else
    update public.votes set raised = p_raised where nomination_id = n.id and seat = p_seat;
  end if;
  if n.status = 'counted' then
    update public.nominations set vote_count = (select count(*) from public.votes where nomination_id = n.id and locked and raised)
    where id = n.id;
  end if;
end $$;

-- VOTE-13: the DM closes a completed vote.
create function public.close_vote(p_nomination uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n public.nominations := private.nomination_as_dm(p_nomination);
begin
  if n.status <> 'counted' then
    perform private.fail('NOT_COUNTED');
  end if;
  update public.nominations set status = 'closed', closed_at = now() where id = n.id;
end $$;

-- VOTE-14: at the end of the day, execute the player on the block, or 无人处决.
create function public.conclude_day(p_game uuid, p_execute boolean) returns int
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
  target int;
begin
  if g.phase_kind <> 'day' then
    perform private.fail('NOT_DAY');
  end if;
  if (private.open_nomination_of(g.id)).id is not null then
    perform private.fail('NOMINATION_OPEN');
  end if;
  if exists (select 1 from public.day_results where game_id = g.id and day_number = g.phase_number) then
    perform private.fail('DAY_OVER');
  end if;
  if coalesce(p_execute, false) then
    target := private.on_the_block(g.id, g.phase_number);
    if target is null then
      perform private.fail('NOBODY_ON_BLOCK');
    end if;
    if (private.game_seat(g.id, target)).alive then
      perform private.kill(g, target, 'executed', null);
    end if;
  end if;
  insert into public.day_results (game_id, day_number, executed_seat) values (g.id, g.phase_number, target);
  perform private.touch(g.room_id);
  return target;
end $$;

-- ───────────────────────────── Board ─────────────────────────────

-- BOARD-01: seated players (alive or dead) and the DM post 1–140 characters, tagged with the phase.
create function public.post_board(p_game uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  g public.games;
  my_seat int;
  body text := btrim(coalesce(p_body, ''));
  new_id uuid;
begin
  select * into g from public.games where id = p_game;
  if not found or not private.is_game_member(p_game) then
    perform private.fail('GAME_NOT_FOUND');
  end if;
  if g.status <> 'in_progress' then
    perform private.fail('NOT_IN_PROGRESS');
  end if;
  select seat into my_seat from public.game_seats where game_id = g.id and user_id = uid;
  if my_seat is null and g.dm_id is distinct from uid then
    perform private.fail('NOT_SEATED');
  end if;
  if char_length(body) not between 1 and 140 then
    perform private.fail('POST_LENGTH');
  end if;
  insert into public.board_posts (game_id, author_id, seat, is_dm, body, phase_kind, phase_number)
  values (g.id, uid, case when g.dm_id = uid then null else my_seat end, g.dm_id = uid, body, g.phase_kind, g.phase_number)
  returning id into new_id;
  perform private.touch(g.room_id);
  return new_id;
end $$;

-- BOARD-03: authors delete their own posts, the DM any post; nobody edits.
create function public.delete_post(p_post uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  p public.board_posts;
  g public.games;
begin
  select * into p from public.board_posts where id = p_post;
  if not found or not private.is_game_member(p.game_id) then
    perform private.fail('POST_NOT_FOUND');
  end if;
  select * into g from public.games where id = p.game_id;
  if p.author_id is distinct from uid and g.dm_id is distinct from uid then
    perform private.fail('FORBIDDEN');
  end if;
  if g.status <> 'in_progress' then
    perform private.fail('NOT_IN_PROGRESS');
  end if;
  delete from public.board_posts where id = p.id;
end $$;

-- ───────────────────────────── Ending ─────────────────────────────

-- END-01 / END-02 / END-04: the DM names the winning team. Roles become visible to the
-- participants (SECRET-03), and the room is back in its lobby with seats kept.
create function public.end_game(p_game uuid, p_winner public.alignment) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
begin
  if p_winner is null then
    perform private.fail('WINNER_REQUIRED');
  end if;
  update public.nominations set status = 'cancelled', closed_at = now()
  where game_id = g.id and status in ('open', 'voting', 'counted');
  update public.games set status = 'ended', winner = p_winner, ended_at = now() where id = g.id;
  perform private.touch(g.room_id);
end $$;

-- STATS-04: remember each seat's starting role.
create or replace function public.start_game(p_game uuid) returns void
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
  update public.seat_roles set starting_role_id = actual_role_id where game_id = g.id;
  update public.games set status = 'in_progress', phase_kind = 'night', phase_number = 1, started_at = now() where id = g.id;
  perform private.touch(g.room_id);
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(uuid), private.is_game_member(uuid), private.is_game_dm(uuid), private.can_see_secrets(uuid) to authenticated;

alter publication supabase_realtime add table
  public.game_deaths, public.nominations, public.votes, public.day_results, public.board_posts;
