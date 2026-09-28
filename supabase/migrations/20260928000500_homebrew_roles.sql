-- SCRIPT-04 (changed 2026-09-28): every non-official role belongs to the 自制角色 collection
-- ('homebrew'), whether it was made in the script editor or by Claude from a script photo (M6).
alter table public.roles drop constraint roles_edition_check;
alter table public.roles add constraint roles_edition_check check (edition in ('tb', 'bmr', 'snv', 'exp', 'hdcs', 'homebrew'));
update public.roles set edition = 'homebrew' where not is_official;
-- Official roles never sit in 自制角色, and custom roles always do.
alter table public.roles add constraint roles_homebrew_check check (coalesce(edition = 'homebrew', false) = not is_official);

create or replace function public.create_custom_role(
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
  insert into public.roles (id, name, team, ability, glyph, reminders, edition, is_official, created_by)
  values (new_id, v_name, p_team, v_ability, v_glyph, coalesce(p_reminders, '{}'), 'homebrew', false, uid);
  return new_id;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
