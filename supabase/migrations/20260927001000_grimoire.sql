-- M4 · Grimoire (docs/rules/m4-grimoire.md: TOKEN, LOG, GRIM) and mid-game role changes.
--
-- Tokens and the DM log are secrets like roles: only the DM reads them until the game
-- ends, then its participants (can_see_secrets, SECRET-03).

create type public.token_kind as enum ('poisoned', 'drunk', 'reminder', 'custom');

-- TOKEN-01
create table public.grimoire_tokens (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  seat int not null check (seat between 1 and 15),
  kind public.token_kind not null,
  -- 中毒 / 醉酒 for the fixed kinds; a script reminder; or custom text (≤ 8 characters).
  label text not null check (char_length(label) between 1 and 20),
  created_at timestamptz not null default now()
);
create index grimoire_tokens_game on public.grimoire_tokens (game_id);

-- LOG-01
create table public.dm_log (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  seat int check (seat between 1 and 15),
  body text not null check (char_length(body) between 1 and 500),
  phase_kind text not null check (phase_kind in ('night', 'day')),
  phase_number int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index dm_log_game on public.dm_log (game_id, created_at);

alter table public.grimoire_tokens enable row level security;
alter table public.dm_log enable row level security;
-- TOKEN-02 / LOG-02
create policy "DM reads tokens" on public.grimoire_tokens
  for select to authenticated using (private.can_see_secrets(game_id));
create policy "DM reads the log" on public.dm_log
  for select to authenticated using (private.can_see_secrets(game_id));

-- Mid-game role changes (GRIM-03) can give two seats the same role, e.g. a new demon.
-- Setup still keeps roles unique (assign_seat, draw_card).
alter table public.seat_roles drop constraint seat_roles_game_id_actual_role_id_key;

-- ───────────────────────────── Tokens ─────────────────────────────

-- TOKEN-01: 中毒, 醉酒, one of the script's reminders, or custom text of up to 8 characters.
create function public.add_token(p_game uuid, p_seat int, p_kind public.token_kind, p_text text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
  v_text text := btrim(coalesce(p_text, ''));
  v_label text;
  new_id uuid;
begin
  perform private.game_seat(p_game, p_seat);
  if p_kind is null then
    perform private.fail('TOKEN_INVALID');
  end if;
  if p_kind = 'poisoned' then
    v_label := '中毒';
  elsif p_kind = 'drunk' then
    v_label := '醉酒';
  elsif p_kind = 'reminder' then
    if not exists (select 1 from public.game_roles where game_id = g.id and v_text = any (reminders)) then
      perform private.fail('TOKEN_NOT_IN_SCRIPT');
    end if;
    v_label := v_text;
  else
    if char_length(v_text) not between 1 and 8 then
      perform private.fail('TOKEN_TEXT_LENGTH');
    end if;
    v_label := v_text;
  end if;
  insert into public.grimoire_tokens (game_id, seat, kind, label) values (g.id, p_seat, p_kind, v_label)
  returning id into new_id;
  return new_id;
end $$;

create function public.remove_token(p_token uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.grimoire_tokens;
begin
  perform private.require_user();
  select * into t from public.grimoire_tokens where id = p_token;
  if not found or not private.is_game_member(t.game_id) then
    perform private.fail('TOKEN_NOT_FOUND');
  end if;
  perform private.running_game_as_dm(t.game_id);
  delete from public.grimoire_tokens where id = t.id;
end $$;

-- ───────────────────────────── DM log ─────────────────────────────

-- LOG-01: an entry for a seat (or the whole game), tagged with the current phase.
create function public.add_log(p_game uuid, p_seat int, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
  v_body text := btrim(coalesce(p_body, ''));
  new_id uuid;
begin
  if p_seat is not null then
    perform private.game_seat(p_game, p_seat);
  end if;
  if char_length(v_body) not between 1 and 500 then
    perform private.fail('LOG_LENGTH');
  end if;
  insert into public.dm_log (game_id, seat, body, phase_kind, phase_number)
  values (g.id, p_seat, v_body, g.phase_kind, g.phase_number)
  returning id into new_id;
  return new_id;
end $$;

create function private.log_entry_as_dm(p_entry uuid) returns public.dm_log
language plpgsql security definer set search_path = '' as $$
declare
  e public.dm_log;
begin
  perform private.require_user();
  select * into e from public.dm_log where id = p_entry;
  if not found or not private.is_game_member(e.game_id) then
    perform private.fail('LOG_NOT_FOUND');
  end if;
  perform private.running_game_as_dm(e.game_id);
  return e;
end $$;

create function public.edit_log(p_entry uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.dm_log := private.log_entry_as_dm(p_entry);
  v_body text := btrim(coalesce(p_body, ''));
begin
  if char_length(v_body) not between 1 and 500 then
    perform private.fail('LOG_LENGTH');
  end if;
  update public.dm_log set body = v_body, updated_at = now() where id = e.id;
end $$;

create function public.delete_log(p_entry uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.dm_log := private.log_entry_as_dm(p_entry);
begin
  delete from public.dm_log where id = e.id;
end $$;

-- ───────────────────────────── Roles mid-game ─────────────────────────────

-- GRIM-03 / requirements.md "Mid-game role changes": the DM changes a seat's actual and
-- shown role (from the game's script). The player's screen just shows the new shown role.
create function public.set_seat_role(p_game uuid, p_seat int, p_actual text, p_shown text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
begin
  perform private.game_seat(p_game, p_seat);
  if not exists (select 1 from public.game_roles where game_id = g.id and role_id = p_actual)
     or not exists (select 1 from public.game_roles where game_id = g.id and role_id = coalesce(p_shown, p_actual)) then
    perform private.fail('ROLE_NOT_IN_SCRIPT');
  end if;
  update public.seat_roles set actual_role_id = p_actual, shown_role_id = coalesce(p_shown, p_actual)
  where game_id = g.id and seat = p_seat;
  update public.seat_shown_roles set shown_role_id = coalesce(p_shown, p_actual)
  where game_id = g.id and seat = p_seat;
  perform private.touch(g.room_id);
end $$;

-- GRIM-03: the DM changes a seat's alignment (e.g. a converted player).
create function public.set_alignment(p_game uuid, p_seat int, p_alignment public.alignment) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
begin
  perform private.game_seat(p_game, p_seat);
  if p_alignment is null then
    perform private.fail('INVALID');
  end if;
  update public.seat_roles set alignment = p_alignment where game_id = g.id and seat = p_seat;
  perform private.touch(g.room_id);
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(uuid), private.is_game_member(uuid), private.is_game_dm(uuid), private.can_see_secrets(uuid) to authenticated;

alter publication supabase_realtime add table public.grimoire_tokens, public.dm_log;
