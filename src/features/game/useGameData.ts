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

export interface GameData {
  roles: GameRole[];
  /** DM only (empty for players, by row level security). */
  composition: CompositionRow[];
  /** DM only. */
  seatRoles: SeatRole[];
  /** A player's own shown role; every seat's for the DM. */
  shown: ShownRole[];
  slots: DrawSlot[];
  seats: GameSeat[];
}

const TABLES = ['game_composition', 'seat_roles', 'seat_shown_roles', 'draw_slots', 'game_seats'] as const;

/** Everything the current user may see about one game, kept live. */
export function useGameData(gameId: string) {
  const [data, setData] = useState<GameData | null>(null);

  const load = useCallback(async () => {
    const [roles, composition, seatRoles, shown, slots, seats] = await Promise.all([
      supabase.from('game_roles').select('*').eq('game_id', gameId),
      supabase.from('game_composition').select('*').eq('game_id', gameId),
      supabase.from('seat_roles').select('*').eq('game_id', gameId).order('seat'),
      supabase.from('seat_shown_roles').select('*').eq('game_id', gameId).order('seat'),
      supabase.from('draw_slots').select('*').eq('game_id', gameId).order('card_no'),
      supabase.from('game_seats').select('*').eq('game_id', gameId).order('seat'),
    ]);
    setData({
      roles: roles.data ?? [],
      composition: composition.data ?? [],
      seatRoles: seatRoles.data ?? [],
      shown: shown.data ?? [],
      slots: slots.data ?? [],
      seats: seats.data ?? [],
    });
  }, [gameId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 60);
    };
    reload();
    let channel = supabase.channel(`game:${gameId}`);
    for (const table of TABLES) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `game_id=eq.${gameId}` }, reload);
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') reload();
    });
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [gameId, load]);

  return { data, reload: load };
}
