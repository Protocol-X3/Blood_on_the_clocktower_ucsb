import { beforeEach, describe, expect, it } from 'vitest';
import { admin, clientFor, poolUser, type UserOptions } from '../support/users.ts';

let slot = 0;
beforeEach(() => {
  slot = 0;
});
function user(opts: UserOptions = {}) {
  return poolUser(`it-${slot++}`, opts);
}

const FIVE = [{ role: 'washerwoman' }, { role: 'chef' }, { role: 'drunk', shown: 'empath' }, { role: 'poisoner' }, { role: 'imp' }];

/** A room with a DM, `seated` signed-in players in seats 1…n (the rest filled), and a Trouble Brewing draw-mode setup with five roles. */
async function drawSetup(seated: number) {
  const dm = await user({ level: 'dm_eligible' });
  const dmc = await clientFor(dm);
  const { data: tb } = await admin.from('roles').select('id').eq('edition', 'tb');
  const { data: scriptId, error: scriptError } = await dmc.rpc('save_script', { p_script: null as unknown as string, p_name: '暗流涌动', p_author: '', p_roles: tb!.map((r) => r.id) });
  expect(scriptError).toBeNull();
  const { data: code } = await dmc.rpc('create_room', { p_seat_count: 5 });
  const players = [];
  const roomId = (await dmc.rpc('join_room', { p_code: code! })).data!;
  for (let seat = 1; seat <= seated; seat += 1) {
    const c = await clientFor(await user());
    await c.rpc('join_room', { p_code: code! });
    expect((await c.rpc('take_seat', { p_room: roomId, p_seat: seat })).error).toBeNull();
    players.push(c);
  }
  // SETUP-11: setup needs every seat filled. The other seats' players never act, so they never sign in.
  for (let seat = seated + 1; seat <= 5; seat += 1) {
    const filler = await user();
    expect((await admin.from('room_members').insert({ room_id: roomId, user_id: filler.id, seat })).error).toBeNull();
  }
  const { data: gameId, error } = await dmc.rpc('start_setup', { p_room: roomId, p_script: scriptId!, p_mode: 'draw' });
  expect(error).toBeNull();
  expect((await dmc.rpc('set_composition', { p_game: gameId!, p_roles: FIVE })).error).toBeNull();
  return { dmc, players, gameId: gameId! };
}

describe('M2 card draw', () => {
  it('DRAW-03 · M2.5: in 50 rounds of two players tapping the same card at once, exactly one wins each time', async () => {
    const { dmc, players, gameId } = await drawSetup(2);
    for (let round = 0; round < 50; round += 1) {
      expect((await dmc.rpc('shuffle_cards', { p_game: gameId })).error).toBeNull();
      const card = (round % 5) + 1;
      const results = await Promise.all(players.map((c) => c.rpc('draw_card', { p_game: gameId, p_card: card })));
      const winners = results.filter((r) => !r.error);
      expect(winners).toHaveLength(1);
      expect(results.filter((r) => r.error).map((r) => r.error!.message)).toEqual(['CARD_TAKEN']);
      // The loser picks again and gets a different card.
      const loser = players[results.findIndex((r) => r.error)]!;
      expect((await loser.rpc('draw_card', { p_game: gameId, p_card: (card % 5) + 1 })).error).toBeNull();
    }
  }, 120_000);

  it('DRAW-01: the server shuffle is uniform (chi-square over 300 deals)', async () => {
    const { dmc, gameId } = await drawSetup(0);
    const roles = FIVE.map((f) => f.role);
    const counts = new Map<string, number>(); // "card:role" → times
    const DEALS = 300;
    for (let i = 0; i < DEALS; i += 1) {
      expect((await dmc.rpc('shuffle_cards', { p_game: gameId })).error).toBeNull();
      const { data } = await dmc.from('draw_cards').select('card_no, role_id').eq('game_id', gameId);
      expect(data).toHaveLength(5);
      for (const c of data!) counts.set(`${c.card_no}:${c.role_id}`, (counts.get(`${c.card_no}:${c.role_id}`) ?? 0) + 1);
    }
    const expected = DEALS / 5;
    let chi2 = 0;
    for (let card = 1; card <= 5; card += 1) {
      for (const role of roles) chi2 += ((counts.get(`${card}:${role}`) ?? 0) - expected) ** 2 / expected;
    }
    // 25 cells, 16 degrees of freedom: a fair shuffle exceeds 46 with probability < 0.01%.
    expect(chi2).toBeLessThan(46);
  }, 180_000);
});
