-- PHASE-06: the DM steps the phase back one step (day N → night N, night N → day N−1), to
-- undo an accidental advance. Only the phase moves: deaths, nominations, day results, board
-- posts and log cells all stay as they are. Not before 第1夜, and not during a nomination.
create function public.retreat_phase(p_game uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
begin
  if (private.open_nomination_of(g.id)).id is not null then
    perform private.fail('NOMINATION_OPEN');
  end if;
  if g.phase_kind = 'night' and g.phase_number <= 1 then
    perform private.fail('PHASE_FIRST');
  end if;
  update public.games set
    phase_kind = case when g.phase_kind = 'night' then 'day' else 'night' end,
    phase_number = case when g.phase_kind = 'night' then g.phase_number - 1 else g.phase_number end
  where id = g.id;
  perform private.touch(g.room_id);
end $$;

revoke execute on function public.retreat_phase(uuid) from public, anon;
grant execute on function public.retreat_phase(uuid) to authenticated;
