import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/services/errors';
import { supabase, type Game, type Profile, type Room, type RoomMember } from '@/services/supabase';

export type Member = RoomMember & { profile: Pick<Profile, 'nickname' | 'permission' | 'is_guest' | 'is_bot'> | null };

export type RoomState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'removed' }
  | { status: 'error'; message: string }
  | { status: 'ready'; room: Room; members: Member[]; game: Game | null };

/**
 * Joins the room with this code (ROOM-03/04), loads it, and keeps it live:
 * any change to the room, its members or its game reloads it (ROOM-13).
 */
export function useRoom(code: string, userId: string) {
  const [state, setState] = useState<RoomState>({ status: 'loading' });
  const roomId = useRef<string | null>(null);

  const load = useCallback(async () => {
    const id = roomId.current;
    if (!id) return;
    const [roomRes, membersRes, gameRes] = await Promise.all([
      supabase.from('rooms').select('*').eq('id', id).maybeSingle(),
      supabase.from('room_members').select('*, profile:profiles(nickname, permission, is_guest, is_bot)').eq('room_id', id).order('joined_at'),
      supabase.from('games').select('*').eq('room_id', id).neq('status', 'ended').maybeSingle(),
    ]);
    if (roomRes.error || membersRes.error || gameRes.error) {
      setState({ status: 'error', message: errorMessage(roomRes.error ?? membersRes.error ?? gameRes.error) });
      return;
    }
    const members = (membersRes.data ?? []) as Member[];
    if (!roomRes.data || !members.some((m) => m.user_id === userId)) {
      setState({ status: 'removed' });
      return;
    }
    setState({ status: 'ready', room: roomRes.data, members, game: gameRes.data });
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;
    const channel = { current: null as ReturnType<typeof supabase.channel> | null };

    (async () => {
      const { data, error } = await supabase.rpc('join_room', { p_code: code });
      if (cancelled) return;
      if (error) {
        setState(error.message === 'ROOM_NOT_FOUND' ? { status: 'not_found' } : { status: 'error', message: errorMessage(error) });
        return;
      }
      roomId.current = data;
      await load();
      if (cancelled) return;
      const reload = () => {
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => void load(), 80);
      };
      channel.current = supabase
        .channel(`room:${data}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${data}` }, reload)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${data}` }, reload)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `room_id=eq.${data}` }, reload)
        .subscribe((status) => {
          // Catch up on anything missed while (re)connecting.
          if (status === 'SUBSCRIBED') reload();
        });
    })();

    // RECON: coming back to the tab (e.g. the phone woke up) refreshes the room.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearTimeout(reloadTimer);
      document.removeEventListener('visibilitychange', onVisible);
      if (channel.current) void supabase.removeChannel(channel.current);
    };
  }, [code, load]);

  return { state, reload: load };
}
