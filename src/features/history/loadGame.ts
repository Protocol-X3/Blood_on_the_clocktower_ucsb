// Everything about an ended game that the viewer may read (HIST-02, by row level security).
import type { BoardPost, DayResult, Death, GameRole, GameSeat, LogEntry, Nomination, SeatRole } from '@/features/game/useGameData';
import { supabase, type Game } from '@/services/supabase';

export interface GameRecord {
  game: Game;
  scriptName: string | null;
  seats: GameSeat[];
  roles: SeatRole[];
  library: GameRole[];
  deaths: Death[];
  log: LogEntry[];
  nominations: Nomination[];
  dayResults: DayResult[];
  posts: BoardPost[];
  /** user id → nickname; users who deleted their account are missing (HIST-06). */
  names: Map<string, string>;
}

export async function loadGame(game: Game): Promise<GameRecord> {
  const [seats, roles, library, deaths, log, nominations, dayResults, posts, script] = await Promise.all([
    supabase.from('game_seats').select('*').eq('game_id', game.id).order('seat'),
    supabase.from('seat_roles').select('*').eq('game_id', game.id).order('seat'),
    supabase.from('game_roles').select('*').eq('game_id', game.id),
    supabase.from('game_deaths').select('*').eq('game_id', game.id).order('id'),
    supabase.from('dm_log').select('*').eq('game_id', game.id).order('created_at'),
    supabase.from('nominations').select('*').eq('game_id', game.id).eq('status', 'closed').order('created_at'),
    supabase.from('day_results').select('*').eq('game_id', game.id).order('day_number'),
    supabase.from('board_posts').select('*').eq('game_id', game.id).order('created_at', { ascending: false }),
    game.script_id ? supabase.from('scripts').select('name').eq('id', game.script_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const ids = [...new Set([...(seats.data ?? []).map((s) => s.user_id), game.dm_id].filter((x): x is string => !!x))];
  const { data: profiles } = ids.length ? await supabase.from('profiles').select('id, nickname').in('id', ids) : { data: [] };
  return {
    game,
    scriptName: script.data?.name ?? null,
    seats: seats.data ?? [],
    roles: roles.data ?? [],
    library: library.data ?? [],
    deaths: deaths.data ?? [],
    log: log.data ?? [],
    nominations: nominations.data ?? [],
    dayResults: dayResults.data ?? [],
    posts: posts.data ?? [],
    names: new Map((profiles ?? []).map((p) => [p.id, p.nickname ?? ''])),
  };
}
