-- SCRIPT-09 / SCRIPT-10: DM-eligible users delete scripts and 自制角色 (official roles never).
-- Games already copied their roles (SCRIPT-06), so nothing played is lost.

-- SCRIPT-09: an ended game keeps the name of a script deleted later.
alter table public.games add column script_name text;

create function public.delete_script(p_script uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_name text;
begin
  if not private.can_dm(uid) then
    perform private.fail('FORBIDDEN');
  end if;
  select name into v_name from public.scripts where id = p_script;
  if not found then
    perform private.fail('SCRIPT_NOT_FOUND');
  end if;
  -- A game being set up or played with it finishes first.
  if exists (select 1 from public.games where script_id = p_script and status <> 'ended') then
    perform private.fail('SCRIPT_IN_USE');
  end if;
  update public.games set script_name = v_name where script_id = p_script;
  -- script_roles go with it; games.script_id becomes null.
  delete from public.scripts where id = p_script;
end $$;

create function public.delete_custom_role(p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  r public.roles;
begin
  if not private.can_dm(uid) then
    perform private.fail('FORBIDDEN');
  end if;
  select * into r from public.roles where id = p_role;
  if not found then
    perform private.fail('ROLE_NOT_FOUND');
  end if;
  if r.is_official then
    perform private.fail('ROLE_OFFICIAL');
  end if;
  -- A role still in a script would silently disappear from it: remove it from the script first.
  if exists (select 1 from public.script_roles where role_id = p_role) then
    perform private.fail('ROLE_IN_USE');
  end if;
  delete from public.roles where id = p_role;
end $$;

revoke execute on function public.delete_script(uuid), public.delete_custom_role(text) from public, anon;
grant execute on function public.delete_script(uuid), public.delete_custom_role(text) to authenticated;

-- HIST-01: the script's name, or the name it had when it was deleted.
create or replace function public.profile_history(p_user uuid)
returns table (game_id uuid, ended_at timestamptz, script_name text, winner public.alignment, as_dm boolean,
               seat int, role_name text, final_alignment public.alignment)
language sql stable security definer set search_path = '' as $$
  select g.id, g.ended_at, coalesce(sc.name, g.script_name, '已删除剧本'), g.winner, g.dm_id = p_user,
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
