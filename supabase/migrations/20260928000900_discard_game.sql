-- END-05: the DM can discard a running game instead of ending it. The game is deleted with
-- everything recorded in it (seats, roles, nominations, votes, the board, tokens, the log;
-- every table cascades), so it never reaches stats or history. The room goes back to the
-- lobby with its seats kept, like after an ended game (END-04).
create function public.discard_game(p_game uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.games := private.running_game_as_dm(p_game);
begin
  delete from public.games where id = g.id;
  perform private.touch(g.room_id);
end $$;

revoke execute on function public.discard_game(uuid) from public, anon;
grant execute on function public.discard_game(uuid) to authenticated;
