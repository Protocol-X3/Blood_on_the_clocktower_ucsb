import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkComposition, countByTeam, roleGlyph, type RoleLike } from '@/lib/game/composition';
import { recommendedTeamCounts } from '@/lib/game/teamCounts';
import { TEAMS } from '@/lib/game/teams';

const role = (id: string, team: RoleLike['team'], name = id): RoleLike => ({ id, name, team });

// A script with 13 townsfolk, 4 outsiders, 4 minions and 4 demons (like the base editions).
const SCRIPT: RoleLike[] = [
  ...Array.from({ length: 13 }, (_, i) => role(`t${i}`, 'townsfolk')),
  ...Array.from({ length: 4 }, (_, i) => role(`o${i}`, 'outsider')),
  ...Array.from({ length: 4 }, (_, i) => role(`m${i}`, 'minion')),
  ...Array.from({ length: 4 }, (_, i) => role(`d${i}`, 'demon')),
];

/** The recommended composition for n players, drawn from SCRIPT. */
function recommended(n: number) {
  const r = recommendedTeamCounts(n)!;
  return [
    ...SCRIPT.filter((x) => x.team === 'townsfolk').slice(0, r.townsfolk),
    ...SCRIPT.filter((x) => x.team === 'outsider').slice(0, r.outsider),
    ...SCRIPT.filter((x) => x.team === 'minion').slice(0, r.minion),
    ...SCRIPT.filter((x) => x.team === 'demon').slice(0, r.demon),
  ].map((x) => ({ role: x.id }));
}

describe('role glyph', () => {
  it('LIB-03: the first character of the name, unless the role overrides it', () => {
    expect(roleGlyph({ name: '占卜师' })).toBe('占');
    expect(roleGlyph({ name: '小恶魔', glyph: '魔' })).toBe('魔');
    expect(roleGlyph({ name: ' 送葬者', glyph: '  ' })).toBe('送');
    expect(roleGlyph({ name: '僧侣', glyph: '僧侣' })).toBe('僧');
    expect(roleGlyph({ name: '', glyph: null })).toBe('?');
  });
});

describe('composition', () => {
  it('SETUP-07: counts roles by team', () => {
    expect(countByTeam([role('a', 'demon'), role('b', 'minion'), role('c', 'minion')])).toEqual({ townsfolk: 0, outsider: 0, minion: 2, demon: 1 });
  });

  it('SETUP-07: the recommended composition has no errors and no warnings, for every player count', () => {
    fc.assert(
      fc.property(fc.integer({ min: 5, max: 15 }), (n) => {
        expect(checkComposition(n, recommended(n), SCRIPT)).toEqual({ errors: [], offRecommendation: [] });
      }),
    );
  });

  it('SETUP-07: the wrong number of roles for the seats is an error', () => {
    expect(checkComposition(7, recommended(7).slice(1), SCRIPT).errors).toEqual(['size']);
    expect(checkComposition(7, [...recommended(7), { role: 't12' }], SCRIPT).errors).toContain('size');
  });

  it('SETUP-07: a role used twice is an error', () => {
    const entries = recommended(5);
    entries[0] = { role: entries[1]!.role };
    expect(checkComposition(5, entries, SCRIPT).errors).toEqual(['duplicate']);
  });

  it('SETUP-07 · SETUP-08: a role or shown role outside the script is an error', () => {
    const entries = recommended(5);
    expect(checkComposition(5, [...entries.slice(1), { role: 'nope' }], SCRIPT).errors).toContain('not_in_script');
    expect(checkComposition(5, [{ role: entries[0]!.role, shown: 'nope' }, ...entries.slice(1)], SCRIPT).errors).toEqual(['not_in_script']);
    // A shown role from the script (e.g. the Drunk shown as a Townsfolk) is fine.
    expect(checkComposition(5, [{ role: entries[0]!.role, shown: 't12' }, ...entries.slice(1)], SCRIPT).errors).toEqual([]);
  });

  it('SETUP-07: team counts off the recommendation are only a warning, naming each team', () => {
    // 7 players with a Baron-style swap: 3 townsfolk, 2 outsiders instead of 5 / 0.
    const entries = [...['t0', 't1', 't2', 'o0', 'o1', 'm0', 'd0'].map((r) => ({ role: r }))];
    expect(checkComposition(7, entries, SCRIPT)).toEqual({
      errors: [],
      offRecommendation: [
        { team: 'townsfolk', actual: 3, recommended: 5 },
        { team: 'outsider', actual: 2, recommended: 0 },
      ],
    });
  });

  it('SETUP-07: any valid-size composition sums to the seat count, and the warnings account for every difference', () => {
    fc.assert(
      fc.property(fc.integer({ min: 5, max: 15 }), fc.integer(), (n, seed) => {
        const shuffled = [...SCRIPT].sort((a, b) => ((a.id.charCodeAt(1) * seed) % 7) - ((b.id.charCodeAt(1) * seed) % 7));
        const entries = shuffled.slice(0, n).map((r) => ({ role: r.id }));
        const { errors, offRecommendation } = checkComposition(n, entries, SCRIPT);
        expect(errors).toEqual([]);
        const counts = countByTeam(shuffled.slice(0, n));
        const rec = recommendedTeamCounts(n)!;
        for (const t of TEAMS) {
          const w = offRecommendation.find((o) => o.team === t);
          expect(w ? w.actual !== w.recommended && w.actual === counts[t] : counts[t] === rec[t]).toBe(true);
        }
      }),
    );
  });

  it('SETUP-07: outside 5–15 seats there is no recommendation to warn about', () => {
    expect(checkComposition(4, SCRIPT.slice(0, 4).map((r) => ({ role: r.id })), SCRIPT)).toEqual({ errors: [], offRecommendation: [] });
  });
});
