-- M2 · Role library and scripts (docs/rules/m2-setup-roles.md: LIB, SCRIPT)

create type public.team as enum ('townsfolk', 'outsider', 'minion', 'demon');
create type public.alignment as enum ('good', 'evil');

create table public.roles (
  id text primary key check (id ~ '^[a-z0-9_-]{1,64}$'),
  name text not null check (char_length(name) between 1 and 20),
  team public.team not null,
  ability text not null check (char_length(ability) between 1 and 300),
  -- LIB-03: the token glyph; null means the first character of the name.
  glyph text check (glyph is null or char_length(glyph) = 1),
  reminders text[] not null default '{}',
  edition text check (edition in ('tb', 'bmr', 'snv')),
  is_official boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.scripts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 30 and name = btrim(name)),
  author text check (author is null or char_length(author) <= 30),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.script_roles (
  script_id uuid not null references public.scripts (id) on delete cascade,
  role_id text not null references public.roles (id) on delete restrict,
  position int not null,
  primary key (script_id, role_id) -- SCRIPT-02: no role twice in a script
);

-- LIB-02 / SCRIPT-01: everyone signed in reads; writes only through the functions below.
alter table public.roles enable row level security;
alter table public.scripts enable row level security;
alter table public.script_roles enable row level security;
create policy "signed-in users read roles" on public.roles for select to authenticated using (true);
create policy "signed-in users read scripts" on public.scripts for select to authenticated using (true);
create policy "signed-in users read script roles" on public.script_roles for select to authenticated using (true);

-- SCRIPT-03 / SCRIPT-04: DM-eligible users create custom roles; they join the library, marked custom.
create function public.create_custom_role(
  p_name text,
  p_team public.team,
  p_ability text,
  p_glyph text default null,
  p_reminders text[] default '{}'
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  new_id text := 'custom-' || substr(md5(gen_random_uuid()::text), 1, 10);
  v_name text := btrim(p_name);
  v_ability text := btrim(p_ability);
  v_glyph text := nullif(btrim(coalesce(p_glyph, '')), '');
begin
  if not private.can_dm(uid) then
    perform private.fail('FORBIDDEN');
  end if;
  if v_name is null or char_length(v_name) not between 1 and 20
     or v_ability is null or char_length(v_ability) not between 1 and 300
     or p_team is null
     or (v_glyph is not null and char_length(v_glyph) <> 1) then
    perform private.fail('ROLE_INVALID');
  end if;
  insert into public.roles (id, name, team, ability, glyph, reminders, is_official, created_by)
  values (new_id, v_name, p_team, v_ability, v_glyph, coalesce(p_reminders, '{}'), false, uid);
  return new_id;
end $$;

-- SCRIPT-01 / SCRIPT-02: DM-eligible users create (p_script null) or replace a script.
create function public.save_script(p_script uuid, p_name text, p_author text, p_roles text[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user();
  v_name text := btrim(p_name);
  v_author text := nullif(btrim(coalesce(p_author, '')), '');
  v_script uuid := p_script;
begin
  if not private.can_dm(uid) then
    perform private.fail('FORBIDDEN');
  end if;
  if v_name is null or char_length(v_name) not between 1 and 30 or (v_author is not null and char_length(v_author) > 30) then
    perform private.fail('SCRIPT_NAME_INVALID');
  end if;
  if p_roles is null or cardinality(p_roles) = 0 then
    perform private.fail('SCRIPT_EMPTY');
  end if;
  if (select count(distinct r) from unnest(p_roles) r) <> cardinality(p_roles) then
    perform private.fail('SCRIPT_DUPLICATE_ROLE');
  end if;
  if exists (select 1 from unnest(p_roles) r where not exists (select 1 from public.roles where id = r)) then
    perform private.fail('ROLE_NOT_FOUND');
  end if;

  if v_script is null then
    insert into public.scripts (name, author, created_by) values (v_name, v_author, uid) returning id into v_script;
  else
    update public.scripts set name = v_name, author = v_author, updated_at = now() where id = v_script;
    if not found then
      perform private.fail('SCRIPT_NOT_FOUND');
    end if;
    delete from public.script_roles where script_id = v_script;
  end if;
  insert into public.script_roles (script_id, role_id, position)
  select v_script, r, ordinality from unnest(p_roles) with ordinality as t(r, ordinality);
  return v_script;
end $$;

revoke execute on function public.create_custom_role(text, public.team, text, text, text[]) from public, anon;
revoke execute on function public.save_script(uuid, text, text, text[]) from public, anon;
grant execute on function public.create_custom_role(text, public.team, text, text, text[]) to authenticated;
grant execute on function public.save_script(uuid, text, text, text[]) to authenticated;
