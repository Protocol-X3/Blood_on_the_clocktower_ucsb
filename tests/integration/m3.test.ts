import { describe, expect, it } from 'vitest';
import { admin, clientFor, poolUser } from '../support/users.ts';

describe('M3 vote circle', () => {
  it('VOTE-12: with no ticks from the DM (a sleeping device), the circle waits at the same seat, then resumes from it', async () => {
    const dmc = await clientFor(await poolUser('it-0', { level: 'dm_eligible' }));
    const { data: tb } = await admin.from('roles').select('id').eq('edition', 'tb');
    const { data: script } = await dmc.rpc('save_script', { p_script: null as unknown as string, p_name: '暗流涌动', p_author: '', p_roles: tb!.map((r) => r.id) });
    const { data: code } = await dmc.rpc('create_room', { p_seat_count: 5 });
    const roomId = (await dmc.rpc('join_room', { p_code: code! })).data!;
    for (let seat = 1; seat <= 5; seat += 1) {
      const c = await clientFor(await poolUser(`it-${seat}`));
      await c.rpc('join_room', { p_code: code! });
      await c.rpc('take_seat', { p_room: roomId, p_seat: seat });
    }
    const { data: game } = await dmc.rpc('start_setup', { p_room: roomId, p_script: script!, p_mode: 'manual' });
    const roles = ['washerwoman', 'chef', 'empath', 'poisoner', 'imp'];
    await dmc.rpc('set_composition', { p_game: game!, p_roles: roles.map((role) => ({ role })) });
    for (const [i, role] of roles.entries()) await dmc.rpc('assign_seat', { p_game: game!, p_seat: i + 1, p_role: role });
    await dmc.rpc('start_game', { p_game: game! });
    await dmc.rpc('advance_phase', { p_game: game! });
    const { data: nom } = await dmc.rpc('open_nomination', { p_game: game!, p_nominator: 1, p_nominee: 3 });
    await dmc.rpc('start_vote', { p_nomination: nom! });
    await dmc.rpc('advance_vote', { p_nomination: nom!, p_expected: 0 });
    await dmc.rpc('advance_vote', { p_nomination: nom!, p_expected: 1 });

    const state = async () => (await admin.from('nominations').select('status, hand_index').eq('id', nom!).single()).data!;
    expect(await state()).toEqual({ status: 'voting', hand_index: 2 });
    // The DM's device sleeps: nothing moves the hand.
    await new Promise((r) => setTimeout(r, 3000));
    expect(await state()).toEqual({ status: 'voting', hand_index: 2 });
    // It wakes up with a stale view and ticks twice from what it last saw: only one step happens.
    expect((await dmc.rpc('advance_vote', { p_nomination: nom!, p_expected: 1 })).data).toBe(2);
    expect((await dmc.rpc('advance_vote', { p_nomination: nom!, p_expected: 2 })).data).toBe(3);
    expect(await state()).toEqual({ status: 'voting', hand_index: 3 });
    // Seat 1 (the third in the circle 4, 5, 1, 2, 3) was the next one locked.
    const { data: votes } = await admin.from('votes').select('seat, locked').eq('nomination_id', nom!).order('seat');
    expect(votes!.filter((v) => v.locked).map((v) => v.seat)).toEqual([1, 4, 5]);
  }, 120_000);
});
