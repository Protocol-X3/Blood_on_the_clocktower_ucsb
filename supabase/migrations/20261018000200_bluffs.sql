-- SETUP-12 / SETUP-13 / SECRET-07: 不在场角色 (the Demon's bluffs). In 角色配置 the DM picks
-- up to 3 good roles that aren't in play. The actual Demon sees them on their role card. If a
-- 疯子 (Lunatic) is in play, each bluff also has what the Lunatic sees instead (疯子看到), from
-- any role in the script. Nobody else sees them; the DM always does, and everyone after the end.

create table public.game_bluffs (
  game_id uuid not null references public.games (id) on delete cascade,
  position int not null check (position between 1 and 3),
  role_id text not null,
  lunatic_role_id text not null,
  primary key (game_id, position),
  unique (game_id, role_id),
  foreign key (game_id, role_id) references public.game_roles (game_id, role_id),
  foreign key (game_id, lunatic_role_id) references public.game_roles (game_id, role_id)
);

alter table public.game_bluffs enable row level security;
-- SECRET-07: players never read the table; they get their own set through my_bluffs.
create policy "DM reads the bluffs; everyone after the end" on public.game_bluffs
  for select to authenticated using (private.can_see_secrets(game_id));

-- SETUP-12 / SETUP-13: p_bluffs: [{"role": "chef", "lunatic": "imp"}, …], up to 3, in order.
-- "lunatic" defaults to the bluff itself. An empty array clears them.
create function public.set_bluffs(p_game uuid, p_bluffs jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.setup_game_as_dm(p_game);
begin
  if p_bluffs is null or jsonb_typeof(p_bluffs) <> 'array' then
    perform private.fail('BLUFFS_INVALID');
  end if;
  if jsonb_array_length(p_bluffs) > 3 then
    perform private.fail('BLUFFS_TOO_MANY');
  end if;
  if exists (select 1 from jsonb_array_elements(p_bluffs) e where jsonb_typeof(e -> 'role') is distinct from 'string') then
    perform private.fail('BLUFFS_INVALID');
  end if;
  if (select count(distinct e ->> 'role') from jsonb_array_elements(p_bluffs) e) <> jsonb_array_length(p_bluffs) then
    perform private.fail('BLUFF_DUPLICATE');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_bluffs) e
    where not exists (select 1 from public.game_roles r where r.game_id = g.id and r.role_id = e ->> 'role' and r.team in ('townsfolk', 'outsider'))
  ) then
    perform private.fail('BLUFF_NOT_GOOD');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_bluffs) e
    join public.game_composition c on c.game_id = g.id and c.role_id = e ->> 'role'
  ) then
    perform private.fail('BLUFF_IN_PLAY');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_bluffs) e
    where not exists (select 1 from public.game_roles r where r.game_id = g.id and r.role_id = coalesce(e ->> 'lunatic', e ->> 'role'))
  ) then
    perform private.fail('ROLE_NOT_IN_SCRIPT');
  end if;
  delete from public.game_bluffs where game_id = g.id;
  insert into public.game_bluffs (game_id, position, role_id, lunatic_role_id)
  select g.id, t.ord, t.e ->> 'role', coalesce(t.e ->> 'lunatic', t.e ->> 'role')
  from jsonb_array_elements(p_bluffs) with ordinality as t(e, ord);
  perform private.touch(g.room_id);
end $$;

-- SECRET-07: the caller's own bluffs, once they can see their own card. The actual Demon gets
-- the bluffs, the Lunatic gets what the Lunatic sees (even with no Demon in play), anyone else
-- nothing. Only the bluff roles come back, never the caller's actual role (SECRET-01).
create function public.my_bluffs(p_game uuid) returns table (pos int, role_id text)
language sql stable security definer set search_path = '' as $$
  select b.position, case when sr.actual_role_id = 'lunatic' then b.lunatic_role_id else b.role_id end
  from public.seat_shown_roles ss
  join public.seat_roles sr on sr.game_id = ss.game_id and sr.seat = ss.seat
  join public.game_roles r on r.game_id = sr.game_id and r.role_id = sr.actual_role_id
  join public.game_bluffs b on b.game_id = ss.game_id
  where ss.game_id = p_game and ss.user_id = auth.uid()
    and (sr.actual_role_id = 'lunatic' or r.team = 'demon')
  order by b.position;
$$;

revoke execute on function public.set_bluffs(uuid, jsonb), public.my_bluffs(uuid) from public, anon;
grant execute on function public.set_bluffs(uuid, jsonb), public.my_bluffs(uuid) to authenticated;

-- SETUP-07 / SETUP-08 / SETUP-12: as before, and a bluff that is now in play is dropped.
create or replace function public.set_composition(p_game uuid, p_roles jsonb) returns void
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
  delete from public.game_bluffs b
  where b.game_id = g.id and exists (select 1 from public.game_composition c where c.game_id = g.id and c.role_id = b.role_id);
  perform private.touch(g.room_id);
end $$;

-- SETUP-06 / SETUP-12: as before; a new script also clears the bluffs (they name its roles).
create or replace function public.update_setup(p_game uuid, p_script uuid, p_mode public.assignment_mode) returns void
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
    delete from public.game_bluffs where game_id = g.id;
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

alter publication supabase_realtime add table public.game_bluffs;
