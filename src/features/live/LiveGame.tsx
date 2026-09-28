import { useCallback } from 'react';
import { useGameData } from '@/features/game/useGameData';
import type { Game } from '@/services/supabase';
import { DmLive } from './DmLive';
import { PlayerLive } from './PlayerLive';

type Act = (run: () => PromiseLike<{ error: unknown }>, after?: () => void) => Promise<void>;

/** A running game: the DM's console or a player's screen, both kept live from the database. */
export function LiveGame({
  game,
  isDm,
  me,
  mySeat,
  names,
  act,
}: {
  game: Game;
  isDm: boolean;
  me: string;
  mySeat: number | null;
  names: Map<number, string>;
  act: Act;
}) {
  const { data, reload } = useGameData(game.id);
  const refresh = useCallback(() => void reload(), [reload]);
  // Every action refreshes the game at once, not only through realtime.
  const actAndReload: Act = useCallback(
    (run, after) =>
      act(run, () => {
        after?.();
        refresh();
      }),
    [act, refresh],
  );
  if (!data) return null;
  return isDm ? (
    <DmLive game={game} data={data} me={me} names={names} act={actAndReload} reload={refresh} />
  ) : (
    <PlayerLive game={game} data={data} me={me} mySeat={mySeat} names={names} act={actAndReload} />
  );
}
