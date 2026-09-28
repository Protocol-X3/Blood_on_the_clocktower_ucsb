import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, MIN_PLAYERS, recommendedTeamCounts } from '@/lib/game/teamCounts';

describe('recommendedTeamCounts', () => {
  // Official table from docs/rules/m2-setup-roles.md: [townsfolk, outsider, minion, demon].
  const OFFICIAL: Record<number, [number, number, number, number]> = {
    5: [3, 0, 1, 1],
    6: [3, 1, 1, 1],
    7: [5, 0, 1, 1],
    8: [5, 1, 1, 1],
    9: [5, 2, 1, 1],
    10: [7, 0, 2, 1],
    11: [7, 1, 2, 1],
    12: [7, 2, 2, 1],
    13: [9, 0, 3, 1],
    14: [9, 1, 3, 1],
    15: [9, 2, 3, 1],
  };

  it.each(Object.entries(OFFICIAL))('SETUP-01: %s players → official counts', (players, [t, o, m, d]) => {
    expect(recommendedTeamCounts(Number(players))).toEqual({ townsfolk: t, outsider: o, minion: m, demon: d });
  });

  it('SETUP-02: counts always sum to the player count, with exactly one demon', () => {
    fc.assert(
      fc.property(fc.integer({ min: MIN_PLAYERS, max: MAX_PLAYERS }), (players) => {
        const c = recommendedTeamCounts(players)!;
        expect(c.townsfolk + c.outsider + c.minion + c.demon).toBe(players);
        expect(c.demon).toBe(1);
      }),
    );
  });

  it('SETUP-03: no recommendation below 5 or above 15', () => {
    fc.assert(
      fc.property(fc.oneof(fc.integer({ max: MIN_PLAYERS - 1 }), fc.integer({ min: MAX_PLAYERS + 1 })), (players) => {
        expect(recommendedTeamCounts(players)).toBeNull();
      }),
    );
    expect(recommendedTeamCounts(4)).toBeNull();
    expect(recommendedTeamCounts(16)).toBeNull();
  });

  it('SETUP-03: no recommendation for non-whole or non-finite player counts', () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: false }).filter((n) => !Number.isInteger(n)),
        (players) => {
          expect(recommendedTeamCounts(players)).toBeNull();
        },
      ),
    );
  });
});
