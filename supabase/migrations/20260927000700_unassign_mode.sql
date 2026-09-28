-- SETUP-09: unassigning a seat is part of manual assignment only; in card-draw mode
-- the DM resets draws by reshuffling instead (DRAW-06).
create or replace function public.unassign_seat(p_game uuid, p_seat int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.setup_game_as_dm(p_game);
begin
  if g.assignment_mode <> 'manual' then
    perform private.fail('WRONG_MODE');
  end if;
  delete from public.seat_roles where game_id = g.id and seat = p_seat;
  perform private.touch(g.room_id);
end $$;
