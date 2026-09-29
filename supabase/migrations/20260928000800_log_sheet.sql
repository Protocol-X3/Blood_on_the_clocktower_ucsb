-- The DM log as a spreadsheet (docs/plan/log-spreadsheet.md; rules LOG-01 … LOG-06).
--
-- One row per seat, plus note rows the DM adds; one column per night and day after
-- 座位 / 玩家 / 初始角色 / 角色设置. Each cell holds one text and/or a colour mark.
-- Replaces the entry list (dm_log). Secrecy is unchanged: only the DM reads the log
-- until the game ends, then its participants (can_see_secrets, SECRET-03).

-- red: evil or wrong · yellow: outsider · violet: drunk or poisoned · green: correct ·
-- dead: dead · none: 清除 on top of a row colour.
create type public.log_mark as enum ('red', 'yellow', 'violet', 'green', 'dead', 'none');

-- LOG-05
create table public.dm_log_notes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 12),
  position int not null,
  created_at timestamptz not null default now()
);
create index dm_log_notes_game on public.dm_log_notes (game_id, position);

-- LOG-01 / LOG-06
create table public.dm_log_cells (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  seat int check (seat between 1 and 15),
  note_id uuid references public.dm_log_notes (id) on delete cascade,
  column_kind text not null check (column_kind in ('seat', 'name', 'role', 'setup', 'night', 'day')),
  phase_number int check (phase_number >= 1),
  body text check (char_length(body) between 1 and 500),
  mark public.log_mark,
  updated_at timestamptz not null default now(),
  check ((seat is null) <> (note_id is null)),
  check ((column_kind in ('night', 'day')) = (phase_number is not null)),
  -- 座位 / 玩家 / 初始角色 only take a colour.
  check (body is null or column_kind in ('setup', 'night', 'day')),
  -- An empty cell is no cell.
  check (body is not null or mark is not null),
  unique nulls not distinct (game_id, seat, note_id, column_kind, phase_number)
);
create index dm_log_cells_game on public.dm_log_cells (game_id);

-- LOG-06: the colour of a whole row, set when the game starts (evil → red, outsider → yellow).
-- A cell's own mark, including 'none', wins over it.
create table public.dm_log_row_marks (
  game_id uuid not null references public.games (id) on delete cascade,
  seat int not null check (seat between 1 and 15),
  mark public.log_mark not null check (mark in ('red', 'yellow')),
  primary key (game_id, seat)
);

alter table public.dm_log_notes enable row level security;
alter table public.dm_log_cells enable row level security;
alter table public.dm_log_row_marks enable row level security;
-- LOG-02
create policy "DM reads the log notes" on public.dm_log_notes
  for select to authenticated using (private.can_see_secrets(game_id));
create policy "DM reads the log cells" on public.dm_log_cells
  for select to authenticated using (private.can_see_secrets(game_id));
create policy "DM reads the log row marks" on public.dm_log_row_marks
  for select to authenticated using (private.can_see_secrets(game_id));

-- ───────────── Moving the old entries across (none exist on 2026-09-28; kept for safety) ─────────────

insert into public.dm_log_notes (game_id, label, position)
select distinct game_id, '整局', 1 from public.dm_log where seat is null;

insert into public.dm_log_cells (game_id, seat, note_id, column_kind, phase_number, body)
select l.game_id, l.seat, n.id, l.phase_kind, l.phase_number, left(string_agg(l.body, E'\n' order by l.created_at), 500)
from public.dm_log l
left join public.dm_log_notes n on l.seat is null and n.game_id = l.game_id
group by l.game_id, l.seat, n.id, l.phase_kind, l.phase_number;

drop function public.add_log(uuid, int, text);
drop function public.edit_log(uuid, text);
drop function public.delete_log(uuid);
drop function private.log_entry_as_dm(uuid);
drop table public.dm_log;

-- ───────────── Helpers ─────────────

-- LOG-01: how many nights and days the table shows: min(5, ⌊players / 2⌋), more once the game goes past that.
create function private.log_rounds(g public.games) returns int
language sql immutable set search_path = '' as $$
  select greatest(least(5, g.seat_count / 2), coalesce(g.phase_number, 1));
$$;

-- A log row: exactly one of a seat of the game or one of its note rows.
create function private.log_row(p_game uuid, p_seat int, p_note uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (p_seat is null) = (p_note is null) then
    perform private.fail('LOG_ROW_INVALID');
  end if;
  if p_seat is not null then
    perform private.game_seat(p_game, p_seat);
  elsif not exists (select 1 from public.dm_log_notes where id = p_note and game_id = p_game) then
    perform private.fail('LOG_NOTE_NOT_FOUND');
  end if;
end $$;

-- A column of the table: 座位 / 玩家 / 初始角色 / 角色设置, or a night or day it shows (LOG-01).
create function private.log_column(g public.games, p_column text, p_phase int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_column is null or p_column not in ('seat', 'name', 'role', 'setup', 'night', 'day') then
    perform private.fail('LOG_COLUMN_INVALID');
  end if;
  if p_column in ('night', 'day') then
    if p_phase is null or p_phase < 1 or p_phase > private.log_rounds(g) then
      perform private.fail('LOG_COLUMN_INVALID');
    end if;
  elsif p_phase is not null then
    perform private.fail('LOG_COLUMN_INVALID');
  end if;
end $$;

-- A note row of a running game whose DM is the caller.
create function private.log_note_as_dm(p_note uuid) returns public.dm_log_notes
language plpgsql security definer set search_path = '' as $$
declare
  n public.dm_log_notes;
begin
  perform private.require_user();
  select * into n from public.dm_log_notes where id = p_note;
  if not found or not private.is_game_member(n.game_id) then
    perform private.fail('LOG_NOTE_NOT_FOUND');
  end if;
  perform private.running_game_as_dm(n.game_id);
  return n;
end $$;

create function private.log_label(p_label text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := btrim(coalesce(p_label, ''));
begin
  if char_length(v) > 12 then
    perform private.fail('LOG_LABEL_LENGTH');
  end if;
  return v;
end $$;

-- ───────────── Cells ─────────────

-- LOG-01: write, change or clear (empty text) one cell's text. Earlier and later shown
-- phases are fine (LOG-03); the colour stays.
create function public.set_log_cell(p_game uuid, p_seat int, p_note uuid, p_column text, p_phase int, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
  v_body text := nullif(btrim(coalesce(p_body, '')), '');
begin
  perform private.log_row(g.id, p_seat, p_note);
  perform private.log_column(g, p_column, p_phase);
  if p_column not in ('setup', 'night', 'day') then
    perform private.fail('LOG_COLUMN_INVALID');
  end if;
  if char_length(v_body) > 500 then
    perform private.fail('LOG_LENGTH');
  end if;
  -- A cell left with neither text nor colour is removed.
  if v_body is null then
    delete from public.dm_log_cells
    where game_id = g.id and seat is not distinct from p_seat and note_id is not distinct from p_note
      and column_kind = p_column and phase_number is not distinct from p_phase and mark is null;
  end if;
  update public.dm_log_cells set body = v_body, updated_at = now()
  where game_id = g.id and seat is not distinct from p_seat and note_id is not distinct from p_note
    and column_kind = p_column and phase_number is not distinct from p_phase;
  if not found and v_body is not null then
    insert into public.dm_log_cells (game_id, seat, note_id, column_kind, phase_number, body)
    values (g.id, p_seat, p_note, p_column, p_phase, v_body);
  end if;
end $$;

-- LOG-06: colour many cells at once (one paint stroke): p_mark is a colour, 'clear' (清除), or
-- 'unset' (drop the cell's own colour and show its row's again; 撤销 uses it).
-- p_cells: [{"seat": 3, "column": "night", "phase": 1}, {"note": "<uuid>", "column": "setup"}, …]
create function public.mark_log_cells(p_game uuid, p_cells jsonb, p_mark text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
  c jsonb;
  v_seat int;
  v_note uuid;
  v_column text;
  v_phase int;
  v_mark public.log_mark;
  v_paint public.log_mark;
begin
  if p_mark is null or p_mark not in ('red', 'yellow', 'violet', 'green', 'dead', 'clear', 'unset') then
    perform private.fail('LOG_MARK_INVALID');
  end if;
  v_paint := case when p_mark in ('clear', 'unset') then null else p_mark::public.log_mark end;
  if p_cells is null or jsonb_typeof(p_cells) <> 'array' or jsonb_array_length(p_cells) not between 1 and 500 then
    perform private.fail('LOG_CELLS_INVALID');
  end if;
  for c in select * from jsonb_array_elements(p_cells) loop
    if jsonb_typeof(c) <> 'object' then
      perform private.fail('LOG_CELLS_INVALID');
    end if;
    begin
      v_seat := (c ->> 'seat')::int;
      v_note := (c ->> 'note')::uuid;
      v_phase := (c ->> 'phase')::int;
    exception when others then
      perform private.fail('LOG_CELLS_INVALID');
    end;
    v_column := c ->> 'column';
    perform private.log_row(g.id, v_seat, v_note);
    perform private.log_column(g, v_column, v_phase);
    -- 清除 over a row colour is stored as 'none', so the row's colour doesn't show through.
    v_mark := case when p_mark = 'unset' then null else coalesce(v_paint, case when v_seat is not null and exists (
      select 1 from public.dm_log_row_marks where game_id = g.id and seat = v_seat) then 'none'::public.log_mark end) end;
    if v_mark is null then
      delete from public.dm_log_cells
      where game_id = g.id and seat is not distinct from v_seat and note_id is not distinct from v_note
        and column_kind = v_column and phase_number is not distinct from v_phase and body is null;
    end if;
    update public.dm_log_cells set mark = v_mark, updated_at = now()
    where game_id = g.id and seat is not distinct from v_seat and note_id is not distinct from v_note
      and column_kind = v_column and phase_number is not distinct from v_phase;
    if not found and v_mark is not null then
      insert into public.dm_log_cells (game_id, seat, note_id, column_kind, phase_number, mark)
      values (g.id, v_seat, v_note, v_column, v_phase, v_mark);
    end if;
  end loop;
end $$;

-- ───────────── Note rows (LOG-05) ─────────────

create function public.add_log_note(p_game uuid, p_label text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
  v_label text := private.log_label(p_label);
  new_id uuid;
begin
  if (select count(*) from public.dm_log_notes where game_id = g.id) >= 20 then
    perform private.fail('LOG_NOTE_LIMIT');
  end if;
  insert into public.dm_log_notes (game_id, label, position)
  values (g.id, v_label, coalesce((select max(position) from public.dm_log_notes where game_id = g.id), 0) + 1)
  returning id into new_id;
  return new_id;
end $$;

create function public.rename_log_note(p_note uuid, p_label text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n public.dm_log_notes := private.log_note_as_dm(p_note);
begin
  update public.dm_log_notes set label = private.log_label(p_label) where id = n.id;
end $$;

-- Its cells go with it.
create function public.delete_log_note(p_note uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n public.dm_log_notes := private.log_note_as_dm(p_note);
begin
  delete from public.dm_log_notes where id = n.id;
end $$;

-- ───────────── The start of the game sets the row colours (LOG-06) ─────────────

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
  -- LOG-06: evil rows red, outsider rows yellow (evil wins).
  insert into public.dm_log_row_marks (game_id, seat, mark)
  select g.id, sr.seat, case when sr.alignment = 'evil' then 'red' else 'yellow' end::public.log_mark
  from public.seat_roles sr join public.game_roles gr on gr.game_id = sr.game_id and gr.role_id = sr.actual_role_id
  where sr.game_id = g.id and (sr.alignment = 'evil' or gr.team = 'outsider');
  update public.games set status = 'in_progress', phase_kind = 'night', phase_number = 1, started_at = now() where id = g.id;
  perform private.touch(g.room_id);
end $$;

-- Grants for this migration's functions only (earlier migrations set up the rest).
revoke execute on function
  public.set_log_cell(uuid, int, uuid, text, int, text), public.mark_log_cells(uuid, jsonb, text),
  public.add_log_note(uuid, text), public.rename_log_note(uuid, text), public.delete_log_note(uuid)
  from public, anon;
grant execute on function
  public.set_log_cell(uuid, int, uuid, text, int, text), public.mark_log_cells(uuid, jsonb, text),
  public.add_log_note(uuid, text), public.rename_log_note(uuid, text), public.delete_log_note(uuid)
  to authenticated;
revoke execute on function
  private.log_rounds(public.games), private.log_row(uuid, int, uuid), private.log_column(public.games, text, int),
  private.log_note_as_dm(uuid), private.log_label(text)
  from public, anon, authenticated;

alter publication supabase_realtime add table public.dm_log_notes, public.dm_log_cells, public.dm_log_row_marks;
