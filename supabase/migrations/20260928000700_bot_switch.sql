-- BOT-01 (changed 2026-09-28): the bot sandbox ships with the live app, switched on and off by
-- the admin under 管理, and starts off. The bot functions (20260927000900_bot_sandbox.sql)
-- already refuse with SANDBOX_OFF while it's off; this adds the switch and a way to read it.
insert into private.app_config (key, value) values ('bot_sandbox', 'off')
on conflict (key) do update set value = 'off';

-- Every signed-in user's app asks whether to show the bot tools.
create function public.bot_sandbox_enabled() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select value from private.app_config where key = 'bot_sandbox'), 'off') = 'on';
$$;

-- Only the admin flips the switch.
create function public.set_bot_sandbox(p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  if private.my_permission() is distinct from 'admin' then
    perform private.fail('FORBIDDEN');
  end if;
  if p_on is null then
    perform private.fail('INVALID');
  end if;
  insert into private.app_config (key, value) values ('bot_sandbox', case when p_on then 'on' else 'off' end)
  on conflict (key) do update set value = excluded.value;
end $$;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
