import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../src/services/database.types.ts';
import { admin, clientFor, deleteUsers, poolUser, uniqueNickname, url, type UserOptions } from '../support/users.ts';

const extraIds: string[] = [];
afterAll(async () => {
  await deleteUsers(extraIds);
});

// Integration tests run one file at a time, so each test can reuse slots from 0.
let slot = 0;
beforeEach(() => {
  slot = 0;
});
function user(opts: UserOptions = {}) {
  return poolUser(`it-${slot++}`, opts);
}

describe('M1 accounts', () => {
  it('AUTH-02: guest sign-in is off: an anonymous sign-in is refused and creates no account', async () => {
    const guests = async () => (await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('is_guest', true).eq('is_bot', false)).count;
    const before = await guests();
    const guest = createClient<Database>(url, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const { data, error } = await guest.auth.signInAnonymously();
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
    expect((await guest.rpc('set_nickname', { p_nickname: uniqueNickname('游客') })).error).not.toBeNull();
    expect(await guests()).toBe(before);
  });
});

describe('M1 rooms', () => {
  it('ROOM-07: when two players take the same seat at the same moment, exactly one succeeds', async () => {
    const dm = await user({ level: 'dm_eligible' });
    const players = [await user(), await user()];
    const dmClient = await clientFor(dm);
    const { data: code } = await dmClient.rpc('create_room', { p_seat_count: 15 });
    const clients = await Promise.all(players.map(clientFor));
    const roomIds = await Promise.all(clients.map(async (c) => (await c.rpc('join_room', { p_code: code! })).data!));
    const roomId = roomIds[0]!;

    for (let seat = 1; seat <= 12; seat += 1) {
      const results = await Promise.all(clients.map((c) => c.rpc('take_seat', { p_room: roomId, p_seat: seat })));
      const ok = results.filter((r) => !r.error);
      const refused = results.filter((r) => r.error);
      expect(ok).toHaveLength(1);
      expect(refused.map((r) => r.error!.message)).toEqual(['SEAT_TAKEN']);
      // Everyone steps off again for the next round.
      await Promise.all(clients.map((c) => c.rpc('leave_seat', { p_room: roomId })));
    }
  });

  it('ROOM-14: a room idle for 24 hours cannot be joined, and is marked closed', async () => {
    const dm = await user({ level: 'dm_eligible' });
    const c = await clientFor(dm);
    const { data: code } = await c.rpc('create_room', {});
    const { data: stale } = await admin
      .from('rooms')
      .update({ last_activity_at: new Date(Date.now() - 25 * 3600_000).toISOString() })
      .eq('code', code!)
      .eq('status', 'open')
      .select('id')
      .single();

    const joiner = await clientFor(await user());
    expect((await joiner.rpc('join_room', { p_code: code! })).error?.message).toBe('ROOM_NOT_FOUND');

    // The next successful room action anywhere (or the 10-minute job) records the closure.
    await c.rpc('create_room', {});
    const { data: row } = await admin.from('rooms').select('status, closed_at').eq('id', stale!.id).single();
    expect(row).toMatchObject({ status: 'closed' });
    expect(row!.closed_at).not.toBeNull();
  });
});
