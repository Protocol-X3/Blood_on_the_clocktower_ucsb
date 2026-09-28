import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeStats, formatRate, winRate, type PlayedGame } from '@/lib/game/stats';

const g = (over: Partial<PlayedGame> & { day: number }): PlayedGame => ({
  endedAt: `2026-10-${String(over.day).padStart(2, '0')}T20:00:00Z`,
  winner: 'good',
  asDm: false,
  startingRole: 'chef',
  finalAlignment: 'good',
  ...over,
});

const games = fc.array(
  fc.record({
    day: fc.integer({ min: 1, max: 28 }),
    winner: fc.constantFrom('good' as const, 'evil' as const),
    asDm: fc.boolean(),
    startingRole: fc.constantFrom('chef', 'imp', 'spy', 'monk', 'drunk'),
    finalAlignment: fc.constantFrom('good' as const, 'evil' as const),
  }),
  { maxLength: 30 },
).map((xs) => xs.map((x) => g({ ...x, finalAlignment: x.asDm ? null : x.finalAlignment, startingRole: x.asDm ? null : x.startingRole })));

describe('win rate', () => {
  it('STATS-02: a whole percentage, or — with no games', () => {
    expect(winRate(1, 3)).toBe(33);
    expect(winRate(2, 3)).toBe(67);
    expect(winRate(1, 2)).toBe(50);
    expect(winRate(0, 4)).toBe(0);
    expect(winRate(4, 4)).toBe(100);
    expect(winRate(0, 0)).toBeNull();
    expect(formatRate(null)).toBe('—');
    expect(formatRate(67)).toBe('67%');
  });
});

describe('stats', () => {
  it('STATS-01 · STATS-02 · STATS-05 · M5.2: games played, wins and games as DM', () => {
    const s = computeStats(
      [
        g({ day: 1, winner: 'good', finalAlignment: 'good' }),
        g({ day: 2, winner: 'evil', finalAlignment: 'good' }),
        g({ day: 3, winner: 'evil', finalAlignment: 'evil', startingRole: 'imp' }),
        g({ day: 4, asDm: true, startingRole: null, finalAlignment: null }),
      ],
      false,
    )!;
    expect(s).toMatchObject({ gamesPlayed: 3, wins: 2, rate: 67, gamesAsDm: 1 });
  });

  it('STATS-02 · M5.2: a win is judged by the final alignment, not the starting team', () => {
    // Started as a good Chef, turned evil, evil won: a win.
    const s = computeStats([g({ day: 1, startingRole: 'chef', finalAlignment: 'evil', winner: 'evil' })], false)!;
    expect(s.wins).toBe(1);
    expect(s.byTeam.evil).toEqual({ games: 1, wins: 1, rate: 100 });
    expect(s.byTeam.good).toEqual({ games: 0, wins: 0, rate: null });
  });

  it('STATS-03 · M5.2: win rate by team, separately over good and evil games', () => {
    const s = computeStats(
      [
        g({ day: 1, finalAlignment: 'good', winner: 'good' }),
        g({ day: 2, finalAlignment: 'good', winner: 'evil' }),
        g({ day: 3, finalAlignment: 'good', winner: 'evil' }),
        g({ day: 4, finalAlignment: 'evil', winner: 'evil' }),
      ],
      false,
    )!;
    expect(s.byTeam.good).toEqual({ games: 3, wins: 1, rate: 33 });
    expect(s.byTeam.evil).toEqual({ games: 1, wins: 1, rate: 100 });
  });

  it('STATS-04 · M5.2: the top 3 starting roles; ties go to the more recently played role', () => {
    const s = computeStats(
      [
        g({ day: 1, startingRole: 'imp' }),
        g({ day: 2, startingRole: 'imp' }),
        g({ day: 3, startingRole: 'spy' }),
        g({ day: 9, startingRole: 'monk' }),
        g({ day: 5, startingRole: 'chef' }),
        g({ day: 6, startingRole: 'drunk' }),
      ],
      false,
    )!;
    expect(s.topRoles).toEqual([
      { role: 'imp', count: 2 },
      { role: 'monk', count: 1 },
      { role: 'drunk', count: 1 },
    ]);
  });

  it('STATS-04: "more recently played" means the latest game with that role, whatever order the games come in', () => {
    const s = computeStats([g({ day: 9, startingRole: 'monk' }), g({ day: 1, startingRole: 'monk' }), g({ day: 5, startingRole: 'spy' }), g({ day: 3, startingRole: 'spy' })], false)!;
    expect(s.topRoles.map((t) => t.role)).toEqual(['monk', 'spy']);
  });

  it('STATS-04: a game with no recorded starting role still counts, but not towards most-played roles', () => {
    const s = computeStats([g({ day: 1, startingRole: null }), g({ day: 2, startingRole: 'spy' })], false)!;
    expect(s.gamesPlayed).toBe(2);
    expect(s.topRoles).toEqual([{ role: 'spy', count: 1 }]);
  });

  it('STATS-06 · M5.2: guests have no stats', () => {
    expect(computeStats([g({ day: 1 })], true)).toBeNull();
  });

  it('STATS-01 · STATS-02 · STATS-03 · M5.2: the counts always add up', () => {
    fc.assert(
      fc.property(games, (gs) => {
        const s = computeStats(gs, false)!;
        const played = gs.filter((x) => !x.asDm);
        expect(s.gamesPlayed).toBe(played.length);
        expect(s.gamesAsDm).toBe(gs.length - played.length);
        expect(s.byTeam.good.games + s.byTeam.evil.games).toBe(s.gamesPlayed);
        expect(s.byTeam.good.wins + s.byTeam.evil.wins).toBe(s.wins);
        expect(s.wins).toBe(played.filter((x) => x.finalAlignment === x.winner).length);
        expect(s.rate).toBe(s.gamesPlayed ? Math.round((100 * s.wins) / s.gamesPlayed) : null);
        for (const t of [s.byTeam.good, s.byTeam.evil]) {
          if (t.rate !== null) {
            expect(t.rate).toBeGreaterThanOrEqual(0);
            expect(t.rate).toBeLessThanOrEqual(100);
          }
        }
      }),
    );
  });

  it('STATS-04 · M5.2: the top roles are the most played, at most 3, each counted right', () => {
    fc.assert(
      fc.property(games, (gs) => {
        const s = computeStats(gs, false)!;
        const counts = new Map<string, number>();
        for (const x of gs) if (!x.asDm && x.startingRole) counts.set(x.startingRole, (counts.get(x.startingRole) ?? 0) + 1);
        expect(s.topRoles.length).toBe(Math.min(3, counts.size));
        for (const t of s.topRoles) expect(t.count).toBe(counts.get(t.role));
        const shown = new Set(s.topRoles.map((t) => t.role));
        const least = Math.min(...s.topRoles.map((t) => t.count));
        for (const [role, c] of counts) if (!shown.has(role)) expect(c).toBeLessThanOrEqual(least);
        for (let i = 1; i < s.topRoles.length; i += 1) expect(s.topRoles[i]!.count).toBeLessThanOrEqual(s.topRoles[i - 1]!.count);
      }),
    );
  });
});
