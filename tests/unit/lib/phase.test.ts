import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FIRST_PHASE, nextPhase, phaseLabel, prevPhase, type Phase } from '@/lib/game/phase';

describe('phases', () => {
  it('PHASE-01: a game starts at 第1夜', () => {
    expect(FIRST_PHASE).toEqual({ kind: 'night', number: 1 });
    expect(phaseLabel(FIRST_PHASE)).toBe('第1夜');
  });

  it('PHASE-01: night N → day N → night N+1', () => {
    expect(nextPhase({ kind: 'night', number: 1 })).toEqual({ kind: 'day', number: 1 });
    expect(nextPhase({ kind: 'day', number: 1 })).toEqual({ kind: 'night', number: 2 });
    expect(phaseLabel({ kind: 'day', number: 3 })).toBe('第3天');
  });

  it('PHASE-01 · PHASE-04: advancing 2k times from 第1夜 reaches night k+1, one step forward each time', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), (k) => {
        let p: Phase = FIRST_PHASE;
        let order = 0;
        for (let i = 0; i < 2 * k; i += 1) {
          const next = nextPhase(p);
          const rank = next.number * 2 + (next.kind === 'day' ? 1 : 0);
          expect(rank).toBe(order + 3);
          order += 1;
          p = next;
        }
        expect(p).toEqual({ kind: 'night', number: k + 1 });
      }),
    );
  });

  it('PHASE-06: one step back: day N → night N → day N−1, and nothing before 第1夜', () => {
    expect(prevPhase({ kind: 'day', number: 2 })).toEqual({ kind: 'night', number: 2 });
    expect(prevPhase({ kind: 'night', number: 2 })).toEqual({ kind: 'day', number: 1 });
    expect(prevPhase({ kind: 'day', number: 1 })).toEqual(FIRST_PHASE);
    expect(prevPhase(FIRST_PHASE)).toBeNull();
  });

  it('PHASE-04 · PHASE-06: stepping back exactly undoes one advance, from any phase', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 }), fc.constantFrom<'night' | 'day'>('night', 'day'), (number, kind) => {
        const p: Phase = { kind, number };
        expect(prevPhase(nextPhase(p))).toEqual(p);
        const back = prevPhase(p);
        if (back) expect(nextPhase(back)).toEqual(p);
        else expect(p).toEqual(FIRST_PHASE);
      }),
    );
  });
});
