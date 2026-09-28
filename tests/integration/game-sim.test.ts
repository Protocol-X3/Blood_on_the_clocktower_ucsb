// M3.3 · Model-based simulation: random full games played through the real RPCs,
// with the database compared against the reference model (tests/support/gameModel.ts)
// after every action. Each action's result must match too: the same success, or the
// same refusal code. SIM_GAMES / SIM_PARALLEL / SIM_SEED override the defaults.
import { mkdirSync, writeFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../src/services/database.types.ts';
import { GameModel, type DeathCause, type ModelNomination, type ModelRole, type Outcome } from '../support/gameModel.ts';
import { admin, clientFor, poolUser } from '../support/users.ts';

type Client = SupabaseClient<Database>;

const GAMES = Number(process.env.SIM_GAMES ?? 200);
const PARALLEL = Number(process.env.SIM_PARALLEL ?? 16);
const SEED = Number(process.env.SIM_SEED ?? Date.now() % 1_000_000);
const MAX_PLAYERS = 7;
const MAX_STEPS = 70;

/** mulberry32: a small seeded PRNG, so a failing run can be replayed with SIM_SEED. */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p: number) => next() < p,
    pick: <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)]!,
  };
}
type Rng = ReturnType<typeof rng>;

interface Table {
  dm: Client;
  players: Client[];
  scriptId: string;
  roles: string[];
  script: ModelRole[];
}

interface Sim {
  n: number;
  gameId: string;
  dm: Client;
  /** Index = seat - 1. */
  players: Client[];
  model: GameModel;
  nominationIds: string[];
  postIds: string[];
  tokenIds: string[];
  logIds: string[];
  log: string[];
}

async function newGame(table: Table, r: Rng): Promise<Sim> {
  const n = r.int(5, MAX_PLAYERS);
  const { data: code, error } = await table.dm.rpc('create_room', {
    p_seat_count: n,
  });
  expect(error).toBeNull();
  const roomId = (await table.dm.rpc('join_room', { p_code: code! })).data!;
  const players = table.players.slice(0, n);
  for (const [i, c] of players.entries()) {
    expect((await c.rpc('join_room', { p_code: code! })).error).toBeNull();
    expect((await c.rpc('take_seat', { p_room: roomId, p_seat: i + 1 })).error).toBeNull();
  }
  const { data: gameId } = await table.dm.rpc('start_setup', {
    p_room: roomId,
    p_script: table.scriptId,
    p_mode: 'manual',
  });
  const roles = table.roles.slice(0, n);
  expect(
    (
      await table.dm.rpc('set_composition', {
        p_game: gameId!,
        p_roles: roles.map((role) => ({ role })),
      })
    ).error,
  ).toBeNull();
  for (const [i, role] of roles.entries()) {
    expect(
      (
        await table.dm.rpc('assign_seat', {
          p_game: gameId!,
          p_seat: i + 1,
          p_role: role,
        })
      ).error,
    ).toBeNull();
  }
  expect((await table.dm.rpc('start_game', { p_game: gameId! })).error).toBeNull();
  return {
    n,
    gameId: gameId!,
    dm: table.dm,
    players,
    model: new GameModel(n, table.script.slice(0, n), table.script),
    nominationIds: [],
    postIds: [],
    tokenIds: [],
    logIds: [],
    log: [],
  };
}

/** Runs one action on both sides and checks the database did what the model says. */
async function act(sim: Sim, label: string, expected: Outcome, call: PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  sim.log.push(label);
  const { data, error } = await call;
  const context = `${label}\n  history: ${sim.log.join(' → ')}`;
  if (expected.ok) {
    expect(error?.message ?? null, context).toBeNull();
    if (expected.value !== undefined) expect(data, context).toEqual(expected.value);
  } else {
    expect(error?.message ?? 'succeeded', context).toBe(expected.code);
  }
  return { data, ok: expected.ok };
}

/** The database state, in the model's shape, plus invariants that hold whatever the model says. */
async function compare(sim: Sim) {
  const [game, seats, noms, votes, results, posts, roles, tokens, log] = await Promise.all([
    sim.dm.from('games').select('status, phase_kind, phase_number, winner, vote_speed_ms').eq('id', sim.gameId).single(),
    sim.dm.from('game_seats').select('seat, alive, ghost_vote_used, death_cause').eq('game_id', sim.gameId).order('seat'),
    sim.dm.from('nominations').select('*').eq('game_id', sim.gameId).order('created_at'),
    sim.dm.from('votes').select('*').eq('game_id', sim.gameId),
    sim.dm.from('day_results').select('day_number, executed_seat').eq('game_id', sim.gameId),
    sim.dm.from('board_posts').select('id').eq('game_id', sim.gameId),
    sim.dm.from('seat_roles').select('seat, actual_role_id, shown_role_id, alignment').eq('game_id', sim.gameId).order('seat'),
    sim.dm.from('grimoire_tokens').select('seat, label').eq('game_id', sim.gameId),
    sim.dm.from('dm_log').select('seat, body, phase_kind, phase_number').eq('game_id', sim.gameId).order('created_at'),
  ]);
  const byToken = (a: { seat: number; label: string }, b: { seat: number; label: string }) => a.seat - b.seat || a.label.localeCompare(b.label);
  const m = sim.model;
  const context = `after: ${sim.log.join(' → ')}`;
  expect(
    {
      status: game.data!.status,
      phase: { kind: game.data!.phase_kind, number: game.data!.phase_number },
      winner: game.data!.winner,
      speed: game.data!.vote_speed_ms,
      seats: seats.data!.map((s) => ({
        alive: s.alive,
        ghostVoteUsed: s.ghost_vote_used,
        cause: s.death_cause,
      })),
      nominations: noms.data!.map((n) => ({
        day: n.day_number,
        nominator: n.nominator_seat,
        nominee: n.nominee_seat,
        status: n.status,
        hand: n.hand_index,
        paused: n.paused,
        threshold: n.threshold,
        count: n.vote_count,
        votes: votes
          .data!.filter((v) => v.nomination_id === n.id)
          .sort((a, b) => a.seat - b.seat)
          .map((v) => ({
            raised: v.raised,
            locked: v.locked,
            ghostSpent: v.ghost_spent,
          })),
      })),
      dayResults: Object.fromEntries(results.data!.map((d) => [d.day_number, d.executed_seat])),
      posts: posts.data!.length,
      seatRoles: roles.data!.map((r) => ({ actual: r.actual_role_id, shown: r.shown_role_id, alignment: r.alignment })),
      tokens: tokens.data!.map((t) => ({ seat: t.seat, label: t.label })).sort(byToken),
      log: log.data!.map((e) => ({ seat: e.seat, body: e.body, phase: { kind: e.phase_kind, number: e.phase_number } })),
    },
    context,
  ).toEqual({
    status: m.status,
    phase: m.phase,
    winner: m.winner,
    speed: m.speed,
    seats: m.seats,
    nominations: m.nominations,
    dayResults: Object.fromEntries(m.dayResults),
    posts: m.posts.length,
    seatRoles: m.seatRoles,
    tokens: [...m.tokens].sort(byToken),
    log: m.log,
  });
  // Invariants (M3.3): one open nomination at most; a spent ghost vote is a locked raised
  // hand; a count equals its locked raised hands; the hand never passes the table.
  expect(noms.data!.filter((n) => ['open', 'voting', 'counted'].includes(n.status)).length, context).toBeLessThanOrEqual(1);
  for (const v of votes.data!) if (v.ghost_spent) expect(v.raised && v.locked, context).toBe(true);
  for (const n of noms.data!) {
    expect(n.hand_index, context).toBeLessThanOrEqual(sim.n);
    if (n.vote_count !== null) {
      expect(n.vote_count, context).toBe(votes.data!.filter((v) => v.nomination_id === n.id && v.locked && v.raised).length);
    }
  }
}

// M4 · the grimoire's actions, mixed into every phase.
const GRIMOIRE = ['token', 'token', 'untoken', 'log', 'editLog', 'delLog', 'role', 'align'];

const CAUSES: DeathCause[] = ['executed', 'night', 'other'];

/** One random action, weighted towards moving the game along. */
async function step(sim: Sim, r: Rng, i: number): Promise<void> {
  const m = sim.model;
  const dm = sim.dm;
  const seat = () => (r.chance(0.05) ? r.pick([0, sim.n + 1]) : r.int(1, sim.n));
  const openIndex = m.nominations.findIndex((n) => n === m.openNomination);
  const open: ModelNomination | undefined = m.nominations[openIndex];
  const openId = sim.nominationIds[openIndex];

  if (m.status === 'in_progress' && (i >= MAX_STEPS - 1 || (i > 30 && r.chance(0.03)))) {
    const winner = r.pick(['good', 'evil'] as const);
    await act(sim, `end(${winner})`, m.endGame(winner), dm.rpc('end_game', { p_game: sim.gameId, p_winner: winner }));
    return;
  }

  const roll = r.next();
  if (open && open.status === 'voting' && roll < 0.65) {
    const expected = r.chance(0.9) ? open.hand : r.int(0, sim.n);
    await act(sim, `advance(${expected})`, m.advanceVote(open, expected), dm.rpc('advance_vote', { p_nomination: openId!, p_expected: expected }));
  } else if (open && open.status !== 'counted' && roll < 0.8) {
    const s = r.int(1, sim.n);
    const raised = r.chance(0.6);
    await act(
      sim,
      `hand(${s},${raised})`,
      m.setHand(open, s, raised),
      sim.players[s - 1]!.rpc('set_hand', {
        p_nomination: openId!,
        p_raised: raised,
      }),
    );
  } else if (open && open.status === 'open' && roll < 0.93) {
    await act(sim, 'startVote', m.startVote(open), dm.rpc('start_vote', { p_nomination: openId! }));
  } else if (open && open.status === 'counted' && roll < 0.75) {
    await act(sim, 'close', m.closeVote(open), dm.rpc('close_vote', { p_nomination: openId! }));
  } else if (open && roll < 0.9) {
    const s = seat();
    const raised = r.chance(0.5);
    await act(
      sim,
      `correct(${s},${raised})`,
      m.correctVote(open, s, raised),
      dm.rpc('correct_vote', {
        p_nomination: openId!,
        p_seat: s,
        p_raised: raised,
      }),
    );
  } else {
    await other(sim, r, seat, open, openId);
  }
}

async function other(sim: Sim, r: Rng, seat: () => number, open: ModelNomination | undefined, openId: string | undefined) {
  const m = sim.model;
  const dm = sim.dm;
  const g = sim.gameId;
  const choice = r.pick(
    m.phase.kind === 'day'
      ? m.nominations.some((n) => n.day === m.phase.number && n.status === 'closed') && !m.dayResults.has(m.phase.number)
        ? ['conclude', 'conclude', 'conclude', 'conclude', 'nominate', 'nominate', 'phase', 'kill', 'post', 'lateHand']
        : [
            'nominate',
            'nominate',
            'nominate',
            'nominate',
            'conclude',
            'phase',
            'kill',
            'revive',
            'ghost',
            'post',
            'delete',
            'cancel',
            'pause',
            'speed',
            'lateHand',
            ...GRIMOIRE,
          ]
      : ['phase', 'phase', 'phase', 'kill', 'kill', 'revive', 'ghost', 'post', 'delete', 'nominate', 'speed', ...GRIMOIRE, ...GRIMOIRE],
  );
  switch (choice) {
    case 'token': {
      const s = seat();
      const kind = r.pick(['poisoned', 'drunk', 'reminder', 'custom'] as const);
      const text =
        kind === 'reminder'
          ? r.chance(0.9)
            ? r.pick(m.script.flatMap((x) => x.reminders))
            : '不存在的提示'
          : kind === 'custom'
            ? r.pick(['红鲱鱼', '守护', '八个字的自定义标', '九个字的自定义标记', '  '])
            : null;
      const expected = m.addToken(s, kind, text);
      const { data } = await act(sim, `token(${s},${kind})`, expected, dm.rpc('add_token', { p_game: g, p_seat: s, p_kind: kind, p_text: text as string }));
      if (expected.ok) sim.tokenIds.push(data as string);
      return;
    }
    case 'untoken': {
      if (m.tokens.length === 0) return;
      const i = r.int(0, m.tokens.length - 1);
      const expected = m.removeToken(i);
      await act(sim, `untoken(${i})`, expected, dm.rpc('remove_token', { p_token: sim.tokenIds[i]! }));
      if (expected.ok) sim.tokenIds.splice(i, 1);
      return;
    }
    case 'log': {
      const s = r.chance(0.3) ? null : seat();
      const body = r.chance(0.05) ? r.pick(['   ', '记'.repeat(501)]) : `日志${sim.log.length}`;
      const expected = m.addLog(s, body);
      const { data } = await act(sim, `log(${s ?? '整局'})`, expected, dm.rpc('add_log', { p_game: g, p_seat: s as number, p_body: body }));
      if (expected.ok) sim.logIds.push(data as string);
      return;
    }
    case 'editLog': {
      if (m.log.length === 0) return;
      const i = r.int(0, m.log.length - 1);
      const body = r.chance(0.1) ? '' : `改${sim.log.length}`;
      await act(sim, `editLog(${i})`, m.editLog(i, body), dm.rpc('edit_log', { p_entry: sim.logIds[i]!, p_body: body }));
      return;
    }
    case 'delLog': {
      if (m.log.length === 0) return;
      const i = r.int(0, m.log.length - 1);
      const expected = m.deleteLog(i);
      await act(sim, `delLog(${i})`, expected, dm.rpc('delete_log', { p_entry: sim.logIds[i]! }));
      if (expected.ok) sim.logIds.splice(i, 1);
      return;
    }
    case 'role': {
      const s = seat();
      const ids = m.script.map((x) => x.id);
      const actual = r.chance(0.05) ? 'vortox' : r.pick(ids);
      const shown = r.chance(0.5) ? actual : r.pick(ids);
      await act(sim, `role(${s},${actual}/${shown})`, m.setRole(s, actual, shown), dm.rpc('set_seat_role', { p_game: g, p_seat: s, p_actual: actual, p_shown: shown }));
      return;
    }
    case 'align': {
      const s = seat();
      const a = r.pick(['good', 'evil'] as const);
      await act(sim, `align(${s},${a})`, m.setAlignment(s, a), dm.rpc('set_alignment', { p_game: g, p_seat: s, p_alignment: a }));
      return;
    }
    case 'nominate': {
      const [a, b] = [seat(), seat()];
      const expected = m.openNominationFor(a, b);
      const { data } = await act(sim, `nominate(${a}→${b})`, expected, dm.rpc('open_nomination', { p_game: g, p_nominator: a, p_nominee: b }));
      if (expected.ok) sim.nominationIds.push(data as string);
      return;
    }
    case 'conclude': {
      const execute = r.chance(0.8);
      const expected = m.concludeDay(execute);
      await act(sim, `conclude(${execute})`, expected, dm.rpc('conclude_day', { p_game: g, p_execute: execute }));
      return;
    }
    case 'phase':
      await act(sim, 'phase', m.advancePhase(), dm.rpc('advance_phase', { p_game: g }));
      return;
    case 'kill': {
      const s = seat();
      const cause = r.pick(CAUSES);
      const note = cause === 'other' && r.chance(0.5) ? (r.chance(0.1) ? '长'.repeat(41) : '被恶魔带走') : null;
      await act(
        sim,
        `kill(${s},${cause})`,
        m.killSeat(s, cause, note),
        dm.rpc('kill_seat', {
          p_game: g,
          p_seat: s,
          p_cause: cause,
          p_note: note as string,
        }),
      );
      return;
    }
    case 'revive': {
      const s = seat();
      await act(sim, `revive(${s})`, m.reviveSeat(s), dm.rpc('revive_seat', { p_game: g, p_seat: s }));
      return;
    }
    case 'ghost': {
      const s = seat();
      const used = r.chance(0.5);
      await act(sim, `ghost(${s},${used})`, m.setGhostVote(s, used), dm.rpc('set_ghost_vote', { p_game: g, p_seat: s, p_used: used }));
      return;
    }
    case 'post': {
      const byDm = r.chance(0.2);
      const s = r.int(1, sim.n);
      const body = r.chance(0.05) ? r.pick(['   ', '字'.repeat(141)]) : `第${sim.log.length}条消息`;
      const expected = m.post(byDm ? null : s, body);
      const client = byDm ? dm : sim.players[s - 1]!;
      const { data } = await act(sim, `post(${byDm ? 'DM' : s})`, expected, client.rpc('post_board', { p_game: g, p_body: body }));
      if (expected.ok) sim.postIds.push(data as string);
      return;
    }
    case 'delete': {
      if (m.posts.length === 0) return;
      const index = r.int(0, m.posts.length - 1);
      const byDm = r.chance(0.3);
      const by = byDm ? null : r.int(1, sim.n);
      const id = sim.postIds[index]!;
      const expected = m.deletePost(index, by);
      await act(sim, `delete(${index} by ${by ?? 'DM'})`, expected, (byDm ? dm : sim.players[by! - 1]!).rpc('delete_post', { p_post: id }));
      if (expected.ok) sim.postIds.splice(index, 1);
      return;
    }
    case 'cancel':
      if (open) await act(sim, 'cancel', m.cancelNomination(open), dm.rpc('cancel_nomination', { p_nomination: openId! }));
      return;
    case 'pause':
      if (open) {
        const paused = r.chance(0.5);
        await act(
          sim,
          `pause(${paused})`,
          m.setPaused(open, paused),
          dm.rpc('set_vote_paused', {
            p_nomination: openId!,
            p_paused: paused,
          }),
        );
      }
      return;
    case 'speed': {
      const ms = r.pick([250, 500, 1500, 3000, 3500]);
      await act(sim, `speed(${ms})`, m.setSpeed(ms), dm.rpc('set_vote_speed', { p_game: g, p_ms: ms }));
      return;
    }
    case 'lateHand': {
      // A hand on a nomination that is no longer open.
      const index = sim.nominationIds.length - 1;
      if (index < 0) return;
      const nom = m.nominations[index]!;
      const s = r.int(1, sim.n);
      await act(
        sim,
        `lateHand(${s})`,
        m.setHand(nom, s, true),
        sim.players[s - 1]!.rpc('set_hand', {
          p_nomination: sim.nominationIds[index]!,
          p_raised: true,
        }),
      );
      return;
    }
  }
}

async function play(table: Table, index: number) {
  const r = rng(SEED * 1000 + index);
  const sim = await newGame(table, r);
  for (let i = 0; i < MAX_STEPS + 5; i += 1) {
    await step(sim, r, i);
    await compare(sim);
    // After the end, a few more random actions check that everything is refused.
    if (sim.model.status === 'ended' && r.chance(0.5)) break;
  }
  expect(sim.model.status).toBe('ended');
  return sim;
}

describe('M3 simulation', () => {
  it(`M3.3 · PHASE-01 · PHASE-04 · DEATH-04 · VOTE-04 · VOTE-07 · VOTE-08 · VOTE-11: ${GAMES} random games through the real RPCs match the reference model (seed ${SEED})`, async () => {
    const dmUser = await poolUser('sim-dm', { level: 'dm_eligible' });
    const playerUsers = await Promise.all(Array.from({ length: MAX_PLAYERS }, (_, i) => poolUser(`sim-${i}`)));
    const dm = await clientFor(dmUser);
    const players = await Promise.all(playerUsers.map((u) => clientFor(u)));
    const { data: tb } = await admin.from('roles').select('id, team, reminders').eq('edition', 'tb').order('id');
    const { data: scriptId } = await dm.rpc('save_script', {
      p_script: null as unknown as string,
      p_name: '模拟剧本',
      p_author: '',
      p_roles: tb!.map((x) => x.id),
    });
    const table: Table = {
      dm,
      players,
      scriptId: scriptId!,
      roles: tb!.map((x) => x.id),
      script: tb!.map((x) => ({ id: x.id, team: x.team, reminders: x.reminders })),
    };

    let next = 0;
    const stats = { games: 0, nominations: 0, executions: 0, deaths: 0 };
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL, GAMES) }, async () => {
        while (next < GAMES) {
          const sim = await play(table, next++);
          stats.games += 1;
          stats.nominations += sim.model.nominations.length;
          stats.executions += [...sim.model.dayResults.values()].filter((s) => s !== null).length;
          stats.deaths += sim.model.seats.filter((s) => !s.alive).length;
        }
      }),
    );
    // For the milestone report.
    mkdirSync('reports/results', { recursive: true });
    writeFileSync('reports/results/simulation.json', JSON.stringify({ seed: SEED, ...stats }, null, 2));
    expect(stats.games).toBe(GAMES);
    // The random walk must actually reach the interesting parts.
    expect(stats.nominations).toBeGreaterThan(GAMES);
    expect(stats.executions).toBeGreaterThan(GAMES / 10);
  }, 1_800_000);
});
