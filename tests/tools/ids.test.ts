// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readRuleFiles, readTestFiles, ROOT } from '../../tools/lib/files.ts';
import { currentMilestone, findIds, inScope, parseCriteria, parseRules, RULE_ID, ruleCoverage } from '../../tools/lib/ids.ts';

// Fixture IDs are assembled at runtime so this file doesn't itself "cover" or
// "mention" them in the eyes of the checker it tests.
const id = (area: string, n: string) => `${area}-${n}`;
const A1 = id('ZZA', '01');
const A2 = id('ZZA', '02');
const B1 = id('ZZB', '01');

const rules = (body: string) => [{ path: 'docs/rules/m1-test.md', text: body }];

describe('rule checker', () => {
  it('QA-05 · M0.5: an active rule without any test is reported missing', () => {
    const catalog = parseRules(rules(`- **${A1}** one\n- **${A2}** two`));
    const report = ruleCoverage(catalog, [{ path: 't.test.ts', text: `it('${A1}: works')` }]);
    expect(report.missing).toEqual([A2]);
    expect(report.unknown).toEqual([]);
  });

  it('QA-05 · M0.5: a test naming an undefined rule ID is reported as unknown', () => {
    const catalog = parseRules(rules(`- **${A1}** one`));
    const report = ruleCoverage(catalog, [{ path: 't.test.ts', text: `it('${A1} and ${B1}')` }]);
    expect(report.unknown).toEqual([`${B1} in t.test.ts`]);
  });

  it('QA-05: retired rules are neither required nor unknown, and code blocks are ignored', () => {
    const catalog = parseRules(rules(`- ~~**${B1}**~~ retired\n\`\`\`md\n- **${A2}** example\n\`\`\`\n- **${A1}** real`));
    expect([...catalog.active.keys()]).toEqual([A1]);
    const report = ruleCoverage(catalog, [{ path: 't.test.ts', text: `${A1} ${B1}` }]);
    expect(report.missing).toEqual([]);
    expect(report.unknown).toEqual([]);
  });

  it('QA-05: a rule defined twice is reported', () => {
    expect(parseRules(rules(`- **${A1}** one\n- **${A1}** again`)).duplicates).toEqual([A1]);
  });

  it('QA-05: rules become required phase by phase', () => {
    expect(currentMilestone('- **Rules in force through: M2.**')).toBe(2);
    expect(currentMilestone('no marker')).toBeNull();
    expect(inScope('docs/rules/m1-accounts-rooms.md', 2)).toBe(true);
    expect(inScope('docs/rules/m3-live-game.md', 2)).toBe(false);
    expect(inScope('docs/rules/m3-live-game.md', null)).toBe(true);
    const catalog = parseRules([
      { path: 'docs/rules/m0-x.md', text: `- **${A1}** now` },
      { path: 'docs/rules/m4-x.md', text: `- **${A2}** later` },
    ]);
    expect(ruleCoverage(catalog, [], (f) => inScope(f, 0)).missing).toEqual([A1]);
  });

  it('QA-09: reads a milestone’s exit-criterion IDs from the roadmap tables', () => {
    const m = (x: string) => `M${x}`;
    const roadmap = `| ${m('1.1')} | a | b |\n| ${m('1.2')} | a | b |\n| ${m('2.1')} | a | b |\n| G1 | gate | x |`;
    expect(parseCriteria(roadmap, 'M1')).toEqual([m('1.1'), m('1.2')]);
    expect(findIds(`x ${A1} y ${A1}`, RULE_ID)).toEqual(new Set([A1]));
  });

  it('QA-05 · M0.6 · M1.1 · M2.1: every rule of the phases so far has a test in the real repository', () => {
    const current = currentMilestone(readFileSync(join(ROOT, 'docs', 'plan', 'roadmap.md'), 'utf8'));
    const catalog = parseRules(readRuleFiles());
    const report = ruleCoverage(catalog, readTestFiles(), (f) => inScope(f, current));
    expect(catalog.active.size).toBeGreaterThan(100);
    expect(report.missing).toEqual([]);
    expect(report.unknown).toEqual([]);
  });
});
