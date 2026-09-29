import { useCallback, useEffect, useState } from 'react';
import type { Database } from '@/services/database.types';
import { supabase } from '@/services/supabase';

type T = Database['public']['Tables'];
export type GameRole = T['game_roles']['Row'];
export type CompositionRow = T['game_composition']['Row'];
export type SeatRole = T['seat_roles']['Row'];
export type ShownRole = T['seat_shown_roles']['Row'];
export type DrawSlot = T['draw_slots']['Row'];
export type GameSeat = T['game_seats']['Row'];
export type Nomination = T['nominations']['Row'];
export type VoteRow = T['votes']['Row'];
export type Death = T['game_deaths']['Row'];
export type DayResult = T['day_results']['Row'];
export type BoardPost = T['board_posts']['Row'];
export type GrimoireToken = T['grimoire_tokens']['Row'];
export type LogCell = T['dm_log_cells']['Row'];
export type LogNote = T['dm_log_notes']['Row'];
export type LogRowMark = T['dm_log_row_marks']['Row'];

export interface GameData {
  roles: GameRole[];
  /** DM only (empty for players, by row level security). */
  composition: CompositionRow[];
  /** DM only, until the game ends. */
  seatRoles: SeatRole[];
  /** A player's own shown role; every seat's for the DM. */
  shown: ShownRole[];
  slots: DrawSlot[];
  seats: GameSeat[];
  nominations: Nomination[];
  votes: VoteRow[];
  deaths: Death[];
  dayResults: DayResult[];
  posts: BoardPost[];
  /** DM only, until the game ends (TOKEN-02). */
  tokens: GrimoireToken[];
  /** The log table: DM only, until the game ends (LOG-02). */
  logCells: LogCell[];
  logNotes: LogNote[];
  logRowMarks: LogRowMark[];
}

// Each table is reloaded on its own when it changes, so a vote tick doesn't refetch the roles.
const LOADERS = {
  roles: (g: string) => supabase.from('game_roles').select('*').eq('game_id', g),
  composition: (g: string) => supabase.from('game_composition').select('*').eq('game_id', g),
  seatRoles: (g: string) => supabase.from('seat_roles').select('*').eq('game_id', g).order('seat'),
  shown: (g: string) => supabase.from('seat_shown_roles').select('*').eq('game_id', g).order('seat'),
  slots: (g: string) => supabase.from('draw_slots').select('*').eq('game_id', g).order('card_no'),
  seats: (g: string) => supabase.from('game_seats').select('*').eq('game_id', g).order('seat'),
  nominations: (g: string) => supabase.from('nominations').select('*').eq('game_id', g).order('created_at'),
  votes: (g: string) => supabase.from('votes').select('*').eq('game_id', g),
  deaths: (g: string) => supabase.from('game_deaths').select('*').eq('game_id', g).order('id'),
  dayResults: (g: string) => supabase.from('day_results').select('*').eq('game_id', g).order('day_number'),
  posts: (g: string) => supabase.from('board_posts').select('*').eq('game_id', g).order('created_at', { ascending: false }),
  tokens: (g: string) => supabase.from('grimoire_tokens').select('*').eq('game_id', g).order('created_at'),
  logCells: (g: string) => supabase.from('dm_log_cells').select('*').eq('game_id', g),
  logNotes: (g: string) => supabase.from('dm_log_notes').select('*').eq('game_id', g).order('position'),
  logRowMarks: (g: string) => supabase.from('dm_log_row_marks').select('*').eq('game_id', g),
} satisfies Record<keyof GameData, (g: string) => PromiseLike<{ data: unknown[] | null }>>;

type Key = keyof GameData;
const TABLE_OF: Partial<Record<string, Key>> = {
  game_composition: 'composition',
  seat_roles: 'seatRoles',
  seat_shown_roles: 'shown',
  draw_slots: 'slots',
  game_seats: 'seats',
  nominations: 'nominations',
  votes: 'votes',
  game_deaths: 'deaths',
  day_results: 'dayResults',
  board_posts: 'posts',
  grimoire_tokens: 'tokens',
  dm_log_cells: 'logCells',
  dm_log_notes: 'logNotes',
  dm_log_row_marks: 'logRowMarks',
};
const KEYS = Object.keys(LOADERS) as Key[];

// supabase-js reuses a channel with the same name, so each hook instance gets its own.
let channels = 0;

/** Everything the current user may see about one game, kept live (RECON-01: all of it comes from the database). */
export function useGameData(gameId: string) {
  const [data, setData] = useState<GameData | null>(null);

  const loadKeys = useCallback(
    async (keys: Key[]) => {
      const results = await Promise.all(keys.map((k) => LOADERS[k](gameId)));
      setData((prev) => {
        const next = { ...(prev ?? (Object.fromEntries(KEYS.map((k) => [k, []])) as unknown as GameData)) };
        keys.forEach((k, i) => {
          (next as Record<Key, unknown[]>)[k] = results[i]!.data ?? [];
        });
        return next;
      });
    },
    [gameId],
  );
  const load = useCallback(() => loadKeys(KEYS), [loadKeys]);

  useEffect(() => {
    const pending = new Set<Key>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reload = (keys: Key[]) => {
      keys.forEach((k) => pending.add(k));
      clearTimeout(timer);
      timer = setTimeout(() => {
        const batch = [...pending];
        pending.clear();
        void loadKeys(batch);
      }, 40);
    };
    reload(KEYS);
    channels += 1;
    let channel = supabase.channel(`game:${gameId}:${channels}`);
    for (const [table, key] of Object.entries(TABLE_OF)) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `game_id=eq.${gameId}` }, () => reload([key!]));
    }
    // Realtime can't filter deletes (their payload holds only the key), so listen to all post deletions.
    for (const [table, key] of [['board_posts', 'posts'], ['grimoire_tokens', 'tokens'], ['dm_log_cells', 'logCells'], ['dm_log_notes', 'logNotes']] as const) {
      channel = channel.on('postgres_changes', { event: 'DELETE', schema: 'public', table }, () => reload([key]));
    }
    channel.subscribe((status) => {
      // (Re)subscribed, e.g. after the phone slept: catch up on everything.
      if (status === 'SUBSCRIBED') reload(KEYS);
    });
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [gameId, loadKeys]);

  return { data, reload: load };
}
