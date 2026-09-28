// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compareLedger, countIds } from '../../tools/lib/ledger.ts';

const id = (area: string, n: string) => `${area}-${n}`;
const A1 = id('ZZA', '01');
const A2 = id('ZZA', '02');
const C1 = `M${'9.1'}`;

describe('test ledger', () => {
  it('QA-08 · M0.9: counts one test per line that names an ID', () => {
    const counts = countIds([
      { text: `it('${A1}: a')\nit('${A1} · ${C1}: b')\nplain line` },
      { text: `it('${A2}: c ${A2}')` },
    ]);
    expect(counts).toEqual({ [C1]: 1, [A1]: 2, [A2]: 1 });
  });

  it('QA-08: a ledger that doesn’t match the tests is out of date', () => {
    const { outdated } = compareLedger({ [A1]: 2 }, { [A1]: 1 }, null);
    expect(outdated).toEqual([`${A1}: tests=2, ledger=1`]);
  });

  it('QA-08 · M0.9: fewer tests than on main fails, even with an updated ledger', () => {
    const { outdated, decreased } = compareLedger({ [A1]: 1 }, { [A1]: 1 }, { [A1]: 3, [A2]: 1 });
    expect(outdated).toEqual([]);
    expect(decreased).toEqual([`${A1}: 3 → 1`, `${A2}: 1 → 0`]);
  });

  it('QA-08: more tests than on main is fine', () => {
    expect(compareLedger({ [A1]: 4 }, { [A1]: 4 }, { [A1]: 3 })).toEqual({ outdated: [], decreased: [] });
  });
});
