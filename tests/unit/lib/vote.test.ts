import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  canRaiseHand,
  circleOrder,
  clampVoteSpeed,
  NOMINATION_WARNING_TEXT,
  nominationWarnings,
  onTheBlock,
  VOTE_SPEED,
  voteCount,
  voteThreshold,
  type Tally,
} from '@/lib/game/vote';

const seats = fc.integer({ min: 1, max: 15 }).chain((n) => fc.tuple(fc.constant(n), fc.integer({ min: 1, max: n })));

describe('vote circle', () => {
  it('VOTE-03: 5 seats, nominee 3 → 4, 5, 1, 2, 3', () => {
    expect(circleOrder(5, 3)).toEqual([4, 5, 1, 2, 3]);
    expect(circleOrder(5, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(circleOrder(15, 1)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 1]);
  });

  it('VOTE-03 · M3.2: every seat exactly once, starting after the nominee and ending with the nominee', () => {
    fc.assert(
      fc.property(seats, ([n, nominee]) => {
        const order = circleOrder(n, nominee);
        expect(order).toHaveLength(n);
        expect(new Set(order).size).toBe(n);
        expect(order.every((s) => s >= 1 && s <= n)).toBe(true);
        expect(order.at(-1)).toBe(nominee);
        expect(order[0]).toBe((nominee % n) + 1);
      }),
    );
  });

  it('VOTE-03 · M3.2: the hand moves clockwise, one seat at a time', () => {
    fc.assert(
      fc.property(seats, ([n, nominee]) => {
        const order = circleOrder(n, nominee);
        order.slice(1).forEach((s, i) => expect(s).toBe((order[i]! % n) + 1));
      }),
    );
  });

  it('VOTE-03: no circle for a nominee outside the table or a malformed seat count', () => {
    expect(circleOrder(5, 0)).toEqual([]);
    expect(circleOrder(5, 6)).toEqual([]);
    expect(circleOrder(5, 2.5)).toEqual([]);
    expect(circleOrder(0, 1)).toEqual([]);
    expect(circleOrder(4.5, 1)).toEqual([]);
    expect(circleOrder(1, 1)).toEqual([1]);
  });
});

describe('threshold and count', () => {
  it('VOTE-10: half the living players, rounded up', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 15].map(voteThreshold)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 8]);
    expect(voteThreshold(-3)).toBe(0);
  });

  it('VOTE-10 · M3.2: the threshold is the smallest count that is at least half', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 15 }), (living) => {
        const t = voteThreshold(living);
        expect(2 * t).toBeGreaterThanOrEqual(living);
        expect(2 * (t - 1)).toBeLessThan(living);
      }),
    );
  });

  it('VOTE-09: only locked raised hands count', () => {
    expect(
      voteCount([
        { raised: true, locked: true },
        { raised: true, locked: false },
        { raised: false, locked: true },
        { raised: true, locked: true },
      ]),
    ).toBe(2);
    expect(voteCount([])).toBe(0);
  });

  it('VOTE-01 · VOTE-02 · M3.2: the living and the dead with an unused ghost vote may raise; a spent ghost vote may not', () => {
    expect(canRaiseHand({ alive: true, ghostVoteUsed: false })).toBe(true);
    expect(canRaiseHand({ alive: true, ghostVoteUsed: true })).toBe(true);
    expect(canRaiseHand({ alive: false, ghostVoteUsed: false })).toBe(true);
    expect(canRaiseHand({ alive: false, ghostVoteUsed: true })).toBe(false);
  });
});

describe('on the block', () => {
  const t = (nominee: number, count: number, threshold = 3): Tally => ({ nominee, count, threshold });

  it('VOTE-11: the highest count at or above the threshold', () => {
    expect(onTheBlock([t(1, 3), t(2, 4), t(3, 2)])).toBe(2);
    expect(onTheBlock([t(1, 3)])).toBe(1);
    expect(onTheBlock([t(1, 2)])).toBeNull();
    expect(onTheBlock([])).toBeNull();
  });

  it('VOTE-11: a tie for the highest count means nobody', () => {
    expect(onTheBlock([t(1, 4), t(2, 4)])).toBeNull();
    expect(onTheBlock([t(1, 4), t(2, 4), t(3, 5)])).toBe(3);
    expect(onTheBlock([t(1, 5), t(2, 4), t(3, 4)])).toBe(1);
  });

  it('VOTE-11: a count below its own threshold neither wins nor ties', () => {
    expect(onTheBlock([t(1, 4, 4), t(2, 4, 5)])).toBe(1);
    expect(onTheBlock([t(1, 3, 4), t(2, 3, 3)])).toBe(2);
  });

  it('VOTE-11: the same nominee twice is not a tie with themselves', () => {
    expect(onTheBlock([t(1, 4), t(1, 4)])).toBe(1);
    expect(onTheBlock([t(1, 4), t(2, 4), t(1, 4)])).toBeNull();
  });

  const tallies = fc.array(
    fc.record({ nominee: fc.integer({ min: 1, max: 15 }), count: fc.integer({ min: 0, max: 15 }), threshold: fc.integer({ min: 0, max: 8 }) }),
    { maxLength: 8 },
  );

  it('VOTE-11 · M3.2: whoever is on the block has the unique highest passing count', () => {
    fc.assert(
      fc.property(tallies, (ts) => {
        const block = onTheBlock(ts);
        const passing = ts.filter((x) => x.count >= x.threshold);
        if (passing.length === 0) {
          expect(block).toBeNull();
          return;
        }
        const max = Math.max(...passing.map((x) => x.count));
        const top = new Set(passing.filter((x) => x.count === max).map((x) => x.nominee));
        expect(block).toBe(top.size === 1 ? [...top][0] : null);
      }),
    );
  });

  it('VOTE-11 · M3.2: the order of the day’s votes does not matter', () => {
    fc.assert(
      fc.property(tallies, (ts) => {
        expect(onTheBlock([...ts].reverse())).toBe(onTheBlock(ts));
      }),
    );
  });
});

describe('nomination warnings', () => {
  it('NOM-02: nominating twice, being nominated twice, or nominating while dead only warns', () => {
    const today = [{ nominator: 1, nominee: 2 }];
    expect(nominationWarnings(today, 3, 4, true)).toEqual([]);
    expect(nominationWarnings(today, 1, 4, true)).toEqual(['nominator_already_nominated']);
    expect(nominationWarnings(today, 3, 2, true)).toEqual(['nominee_already_nominated']);
    expect(nominationWarnings(today, 3, 4, false)).toEqual(['nominator_dead']);
    expect(nominationWarnings(today, 1, 2, false)).toEqual(['nominator_already_nominated', 'nominee_already_nominated', 'nominator_dead']);
    expect(nominationWarnings([], 1, 1, true)).toEqual([]);
  });

  it('NOM-02: each warning has Chinese text', () => {
    expect(NOMINATION_WARNING_TEXT).toEqual({
      nominator_already_nominated: '提名者今天已经提名过',
      nominee_already_nominated: '被提名者今天已经被提名过',
      nominator_dead: '提名者已死亡',
    });
  });
});

describe('clock speed', () => {
  it('VOTE-05: 1.5 s per seat by default, between 0.5 and 3 s', () => {
    expect(VOTE_SPEED).toEqual({ min: 500, max: 3000, default: 1500, step: 250 });
    expect(clampVoteSpeed(100)).toBe(500);
    expect(clampVoteSpeed(9000)).toBe(3000);
    expect(clampVoteSpeed(1234.6)).toBe(1235);
    expect(clampVoteSpeed(500)).toBe(500);
    expect(clampVoteSpeed(3000)).toBe(3000);
    expect(clampVoteSpeed(Number.NaN)).toBe(1500);
  });
});
