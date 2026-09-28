-- M5 · Stats & history (docs/rules/m5-stats-history.md: STATS, HIST)
--
-- HIST-02: an ended game belongs to its participants (the players and the DM) and the
-- admin. Room members who weren't in it, e.g. onlookers, no longer read its details.

-- A player or the DM of the game.
create function private.is_participant(p_game uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.games where id = p_game and dm_id = auth.uid())
      or exists (select 1 from public.game_seats where game_id = p_game and user_id = auth.uid());
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.my_permission() = 'admin', false);
$$;

-- Public game data: the room while it runs; its participants and the admin once it ended.
create function private.can_read_game(p_game uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when g.status = 'ended' then private.is_participant(g.id) or private.is_admin()
    else private.is_game_member(g.id)
  end
  from public.games g where g.id = p_game;
$$;

-- SECRET-02 / SECRET-03 / HIST-02: the DM always; after the end, the participants and the admin.
create or replace function private.can_see_secrets(p_game uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_game_dm(p_game) or exists (
    select 1 from public.games g
    where g.id = p_game and g.status = 'ended' and (private.is_participant(g.id) or private.is_admin())
  );
$$;

drop policy "members read room games" on public.games;
create policy "members read running games; participants and the admin read ended ones" on public.games
  for select to authenticated using (
    case when status = 'ended' then private.is_participant(id) or private.is_admin() else private.is_member(room_id) end
  );

drop policy "room members read the game's script" on public.game_roles;
create policy "readers of the game read its script" on public.game_roles for select to authenticated using (private.can_read_game(game_id));
drop policy "room members read game seats" on public.game_seats;
create policy "readers of the game read its seats" on public.game_seats for select to authenticated using (private.can_read_game(game_id));
drop policy "room members read deaths" on public.game_deaths;
create policy "readers of the game read its deaths" on public.game_deaths for select to authenticated using (private.can_read_game(game_id));
drop policy "room members read nominations" on public.nominations;
create policy "readers of the game read its nominations" on public.nominations for select to authenticated using (private.can_read_game(game_id));
drop policy "room members read votes" on public.votes;
create policy "readers of the game read its votes" on public.votes for select to authenticated using (private.can_read_game(game_id));
drop policy "room members read day results" on public.day_results;
create policy "readers of the game read its day results" on public.day_results for select to authenticated using (private.can_read_game(game_id));
drop policy "room members read the board" on public.board_posts;
create policy "readers of the game read its board" on public.board_posts for select to authenticated using (private.can_read_game(game_id));

-- ───────────────────────────── Stats & history ─────────────────────────────

-- STATS-01..05 / HIST-04: every signed-in user sees anyone's stats. These rows carry no
-- game id or script, so they reveal nothing beyond the numbers (HIST-02).
-- STATS-06 / STATS-07: none for guests; once upgraded, all their games count.
create function public.profile_stat_rows(p_user uuid)
returns table (ended_at timestamptz, winner public.alignment, as_dm boolean, starting_role text, final_alignment public.alignment)
language sql stable security definer set search_path = '' as $$
  select g.ended_at, g.winner, false, sr.starting_role_id, sr.alignment
  from public.games g
  join public.game_seats s on s.game_id = g.id and s.user_id = p_user
  join public.seat_roles sr on sr.game_id = g.id and sr.seat = s.seat
  where g.status = 'ended' and g.winner is not null and auth.uid() is not null
    and exists (select 1 from public.profiles p where p.id = p_user and not p.is_guest)
  union all
  select g.ended_at, g.winner, true, null, null
  from public.games g
  where g.status = 'ended' and g.winner is not null and g.dm_id = p_user and auth.uid() is not null
    and exists (select 1 from public.profiles p where p.id = p_user and not p.is_guest)
  order by 1 desc;
$$;

-- HIST-01: a user's ended games, newest first, with the date, script, their role,
-- alignment and result. Only games the caller may read are listed (HIST-02).
create function public.profile_history(p_user uuid)
returns table (game_id uuid, ended_at timestamptz, script_name text, winner public.alignment, as_dm boolean,
               seat int, role_name text, final_alignment public.alignment)
language sql stable security definer set search_path = '' as $$
  select g.id, g.ended_at, coalesce(sc.name, '已删除剧本'), g.winner, g.dm_id = p_user,
         s.seat, gr.name, sr.alignment
  from public.games g
  left join public.scripts sc on sc.id = g.script_id
  left join public.game_seats s on s.game_id = g.id and s.user_id = p_user
  left join public.seat_roles sr on sr.game_id = g.id and sr.seat = s.seat
  left join public.game_roles gr on gr.game_id = g.id and gr.role_id = sr.starting_role_id
  where g.status = 'ended' and g.winner is not null
    and (g.dm_id = p_user or s.user_id is not null)
    and private.can_read_game(g.id)
  order by g.ended_at desc;
$$;

-- ───────────────────────────── HIST-06 ─────────────────────────────

-- The admin deletes an account on request: the sign-in identity, email and nickname go;
-- the games stay, with the seat showing 已删除用户.
create function public.admin_delete_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not private.is_admin() then
    perform private.fail('FORBIDDEN');
  end if;
  if p_user = auth.uid() then
    perform private.fail('CANNOT_DELETE_SELF');
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    perform private.fail('USER_NOT_FOUND');
  end if;
  if exists (
    select 1 from public.games g
    where g.status <> 'ended'
      and (g.dm_id = p_user or exists (select 1 from public.room_members m where m.room_id = g.room_id and m.user_id = p_user and m.seat is not null))
  ) then
    perform private.fail('USER_IN_GAME');
  end if;
  -- Deleting the auth user deletes the profile; game records keep the seat with no user.
  delete from auth.users where id = p_user;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member(uuid), private.is_game_member(uuid), private.is_game_dm(uuid), private.can_see_secrets(uuid),
  private.is_participant(uuid), private.is_admin(), private.can_read_game(uuid) to authenticated;
