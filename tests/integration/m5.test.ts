import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { computeStats } from '../../src/lib/game/stats.ts';
import type { Database } from '../../src/services/database.types.ts';
import restoreRealAdmin from '../e2e/global-teardown.ts';
import { clearHistory, knownHistory, seedGame } from '../support/fixture.ts';
import { admin, clientFor, deleteUsers, poolUser, uniqueNickname, url, type UserOptions } from '../support/users.ts';

let slot = 0;
beforeEach(() => {
  slot = 0;
});
function user(opts: UserOptions = {}) {
  return poolUser(`it-${slot++}`, opts);
}
const extraIds: string[] = [];
afterAll(async () => {
  await deleteUsers(extraIds);
  // HIST-06 borrowed the admin role.
  await restoreRealAdmin();
});

async function scriptOf(owner: string) {
  const { data } = await admin.from('scripts').insert({ name: '暗流涌动', created_by: owner }).select('id').single();
  return data!.id;
}

const rows = (data: Database['public']['Functions']['profile_stat_rows']['Returns']) =>
  data.map((r) => ({ endedAt: r.ended_at, winner: r.winner, asDm: r.as_dm, startingRole: r.starting_role, finalAlignment: r.final_alignment }));

describe('M5 stats', () => {
  it('STATS-01 · STATS-02 · STATS-03 · STATS-04 · STATS-05: a known history gives the known numbers, for anyone who asks', async () => {
    const [p, dm, a, b, c, d, viewer] = await Promise.all(Array.from({ length: 7 }, () => user()));
    for (const u of [p!, dm!, a!, b!, c!, d!]) await clearHistory(u.id);
    const script = await scriptOf(dm!.id);
    for (const g of knownHistory(p!.id, [a!.id, b!.id, c!.id, d!.id], dm!.id, script)) await seedGame(g);

    // HIST-04: another signed-in user reads the rows.
    const { data, error } = await (await clientFor(viewer!)).rpc('profile_stat_rows', { p_user: p!.id });
    expect(error).toBeNull();
    const stats = computeStats(rows(data!), false)!;
    expect(stats).toEqual({
      gamesPlayed: 5,
      wins: 3,
      rate: 60,
      byTeam: { good: { games: 2, wins: 1, rate: 50 }, evil: { games: 3, wins: 2, rate: 67 } },
      topRoles: [
        { role: 'imp', count: 2 },
        { role: 'chef', count: 2 },
        { role: 'monk', count: 1 },
      ],
      gamesAsDm: 1,
    });
    // STATS-01: running a game as DM is not playing it.
    const dmStats = computeStats(rows((await (await clientFor(viewer!)).rpc('profile_stat_rows', { p_user: dm!.id })).data!), false)!;
    expect(dmStats.gamesAsDm).toBe(5);
    expect(dmStats.gamesPlayed).toBe(1);
  }, 120_000);

  it('STATS-06 · STATS-07: a guest has no stats; after upgrading, their earlier games count', async () => {
    const guestClient = createClient<Database>(url, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    const { data: signIn, error } = await guestClient.auth.signInAnonymously();
    expect(error).toBeNull();
    const guestId = signIn.user!.id;
    extraIds.push(guestId);
    await guestClient.rpc('set_nickname', { p_nickname: uniqueNickname('游客') });
    const [dm, a, b, c, d] = await Promise.all(Array.from({ length: 5 }, () => user()));
    const script = await scriptOf(dm!.id);
    await seedGame({
      endedAt: '2026-09-10T20:00:00Z',
      winner: 'good',
      dm: dm!.id,
      scriptId: script,
      seats: [
        { user: guestId, role: 'chef', alignment: 'good' },
        { user: a!.id, role: 'washerwoman', alignment: 'good' },
        { user: b!.id, role: 'librarian', alignment: 'good' },
        { user: c!.id, role: 'poisoner', alignment: 'evil' },
        { user: d!.id, role: 'imp', alignment: 'evil' },
      ],
    });
    const reader = await clientFor(a!);
    expect((await reader.rpc('profile_stat_rows', { p_user: guestId })).data).toEqual([]);
    // STATS-06: the other players' stats still count the game.
    expect((await reader.rpc('profile_stat_rows', { p_user: c!.id })).data!.some((r) => r.ended_at.startsWith('2026-09-10'))).toBe(true);

    // The guest links a real identity (Google in the app; an email identity stands in here).
    const { error: upgradeError } = await admin.auth.admin.updateUserById(guestId, { email: `e2e-up-${guestId.slice(0, 8)}@test.botc`, email_confirm: true });
    expect(upgradeError).toBeNull();
    const after = (await reader.rpc('profile_stat_rows', { p_user: guestId })).data!;
    expect(computeStats(rows(after), false)).toMatchObject({ gamesPlayed: 1, wins: 1, rate: 100 });
  }, 120_000);
});

describe('M5 accounts', () => {
  it('HIST-06: the admin deletes an account: it can no longer sign in, and its games stay as 已删除用户', async () => {
    const adminUser = await user({ level: 'admin' });
    const [dm, a, b, c] = await Promise.all(Array.from({ length: 4 }, () => user()));
    // A throwaway account (not from the pool, since it is deleted for good).
    const email = `e2e-del-${Date.now()}@test.botc`;
    const { data: created } = await admin.auth.admin.createUser({ email, password: 'delete-me-123456', email_confirm: true });
    const victim = created.user!.id;
    extraIds.push(victim);
    await admin.from('profiles').update({ nickname: uniqueNickname('删') }).eq('id', victim);
    const script = await scriptOf(dm!.id);
    const game = await seedGame({
      endedAt: '2026-09-11T20:00:00Z',
      winner: 'evil',
      dm: dm!.id,
      scriptId: script,
      seats: [
        { user: victim, role: 'imp', alignment: 'evil' },
        { user: a!.id, role: 'chef', alignment: 'good' },
        { user: b!.id, role: 'librarian', alignment: 'good' },
        { user: c!.id, role: 'poisoner', alignment: 'evil' },
        { user: null, role: 'empath', alignment: 'good' },
      ],
    });

    const { error } = await (await clientFor(adminUser)).rpc('admin_delete_user', { p_user: victim });
    expect(error).toBeNull();
    // The sign-in identity and email are gone…
    const signIn = await createClient(url, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } }).auth.signInWithPassword({
      email,
      password: 'delete-me-123456',
    });
    expect(signIn.error).not.toBeNull();
    expect((await admin.auth.admin.getUserById(victim)).data.user).toBeNull();
    expect((await admin.from('profiles').select('id').eq('id', victim)).data).toEqual([]);
    // …and the game record stays, with an empty seat (shown as 已删除用户) and its role.
    const seat = (await admin.from('game_seats').select('user_id').eq('game_id', game).eq('seat', 1).single()).data!;
    expect(seat.user_id).toBeNull();
    const role = (await (await clientFor(a!)).from('seat_roles').select('actual_role_id').eq('game_id', game).eq('seat', 1).single()).data!;
    expect(role.actual_role_id).toBe('imp');
  }, 120_000);
});
