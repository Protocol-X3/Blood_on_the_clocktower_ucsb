-- SETUP-11: setup starts only once every seat has a player. Seats can't change during
-- setup (take_seat / leave_seat refuse while a game is active), so they stay full.
create or replace function public.start_setup(p_room uuid, p_script uuid, p_mode public.assignment_mode) returns uuid
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
  if (select count(*) from public.room_members where room_id = p_room and seat between 1 and r.seat_count) <> r.seat_count then
    perform private.fail('NOT_ALL_SEATED');
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

-- SETUP-06: back at the basics step, the DM changes the script or the assignment mode.
-- A new script replaces the game's roles and clears the composition; a new mode clears
-- only the assignments and draws, keeping the composition. No change keeps everything.
create function public.update_setup(p_game uuid, p_script uuid, p_mode public.assignment_mode) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.setup_game_as_dm(p_game);
begin
  if p_mode is null then
    perform private.fail('MODE_REQUIRED');
  end if;
  if not exists (select 1 from public.scripts where id = p_script) then
    perform private.fail('SCRIPT_NOT_FOUND');
  end if;
  if p_script is not distinct from g.script_id and p_mode = g.assignment_mode then
    return;
  end if;
  delete from public.draw_slots where game_id = g.id;
  delete from public.draw_cards where game_id = g.id;
  delete from public.seat_shown_roles where game_id = g.id;
  delete from public.seat_roles where game_id = g.id;
  if p_script is distinct from g.script_id then
    delete from public.game_composition where game_id = g.id;
    delete from public.game_roles where game_id = g.id;
    insert into public.game_roles (game_id, role_id, name, team, ability, glyph, reminders)
    select g.id, ro.id, ro.name, ro.team, ro.ability, coalesce(ro.glyph, left(ro.name, 1)), ro.reminders
    from public.script_roles sr join public.roles ro on ro.id = sr.role_id
    where sr.script_id = p_script;
  end if;
  update public.games set script_id = p_script, assignment_mode = p_mode where id = g.id;
  perform private.touch(g.room_id);
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
