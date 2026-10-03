-- AUTH-10: accounts nobody can use any more are removed automatically, once a day.
--   (a) A guest with no sign-in session: signing out ends the only session a guest can ever
--       have (AUTH-06), so the account is unreachable. An hour's grace covers sign-in itself.
--   (b) A guest whose sessions have all been idle for 30 days (cleared browser data, a lost
--       phone): a session in use refreshes itself at least hourly.
--   (c) An account, guest or Google, that still has no nickname a day after it was created:
--       sign-in creates the account first and names it second, and the second step was abandoned.
-- Never removed: anyone who has a seat in any game or ran one (their history and stats stay as
-- they are), members of an open room, bots (BOT-02 removes those), and DM-eligible or admin accounts.
create function private.cleanup_accounts() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  with gone as (
    delete from auth.users u
    using public.profiles p
    where p.id = u.id
      and p.permission = 'player' and not p.is_bot
      and not exists (select 1 from public.game_seats gs where gs.user_id = p.id)
      and not exists (select 1 from public.games g where g.dm_id = p.id)
      and not exists (select 1 from public.room_members m join public.rooms r on r.id = m.room_id where m.user_id = p.id and r.status = 'open')
      and (
        (p.nickname is null and u.created_at < now() - interval '1 day')
        or (p.is_guest and u.created_at < now() - interval '1 hour'
            and not exists (select 1 from auth.sessions s where s.user_id = u.id))
        or (p.is_guest and u.created_at < now() - interval '30 days'
            and not exists (
              select 1 from auth.sessions s
              where s.user_id = u.id
                -- refreshed_at has no time zone (it is UTC); the others do.
                and greatest(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at) > now() - interval '30 days'))
      )
    returning u.id
  )
  select count(*) into n from gone;
  return n;
end $$;

revoke execute on function private.cleanup_accounts() from public, anon, authenticated;

-- 11:30 UTC is the small hours in California, well away from game nights.
select cron.schedule('cleanup-accounts', '30 11 * * *', 'select private.cleanup_accounts()');
