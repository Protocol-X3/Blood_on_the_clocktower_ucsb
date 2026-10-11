-- VOTE-15: the DM undoes the current day's result (an execution, or 无人处决) and the day is
-- open again: more nominations, and a new result. An execution undone never happened: the
-- executed player is alive again and that death leaves the record (it is not kept as a
-- revival). The day's nominations and their vote counts stay.
create function public.undo_day_result(p_game uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
  r public.day_results;
  last public.game_deaths;
begin
  if g.phase_kind <> 'day' then
    perform private.fail('NOT_DAY');
  end if;
  select * into r from public.day_results where game_id = g.id and day_number = g.phase_number;
  if not found then
    perform private.fail('DAY_NOT_OVER');
  end if;
  if r.executed_seat is not null then
    -- Still dead from this execution (not revived or killed again since): alive again.
    select * into last from public.game_deaths where game_id = g.id and seat = r.executed_seat order by id desc limit 1;
    if found and last.cause = 'executed' and last.phase_kind = 'day' and last.phase_number = g.phase_number and not last.revived then
      update public.game_seats set alive = true, death_cause = null, death_note = null
      where game_id = g.id and seat = r.executed_seat;
    end if;
    delete from public.game_deaths
    where game_id = g.id and seat = r.executed_seat and cause = 'executed' and phase_kind = 'day' and phase_number = g.phase_number;
  end if;
  delete from public.day_results where game_id = g.id and day_number = g.phase_number;
  perform private.touch(g.room_id);
end $$;

revoke execute on function public.undo_day_result(uuid) from public, anon;
grant execute on function public.undo_day_result(uuid) to authenticated;
