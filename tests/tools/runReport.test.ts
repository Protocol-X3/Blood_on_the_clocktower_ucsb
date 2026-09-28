import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCriteria } from '../../tools/lib/ids.ts';

const read = (p: string) => readFileSync(p, 'utf8');

describe('end of the autonomy run', () => {
  it('M5.5: the final report covers every milestone with evidence, the review items, the autonomy decisions and the launch cleanup', () => {
    const roadmap = read('docs/plan/roadmap.md');
    const run = read('docs/reports/RUN.md');
    for (let n = 0; n <= 5; n += 1) {
      const report = `docs/reports/M${n}.md`;
      // Every milestone has its certified report, linked from the final one…
      expect(existsSync(report), report).toBe(true);
      expect(run).toContain(`(M${n}.md)`);
      expect(run).toContain(`m${n}-done`);
      // …and that report gives evidence for each of its exit criteria (except M5.5, which is this report).
      const text = read(report);
      for (const id of parseCriteria(roadmap, `M${n}`).filter((c) => c !== 'M5.5')) expect(text, `${report} lists ${id}`).toMatch(new RegExp(`\\| ${id.replace('.', '\\.')} \\|`));
    }
    // The owner's review items: the role library, the rules and the [autonomy] decisions.
    expect(run).toContain('official-roles.json');
    expect(run).toContain('docs/rules/');
    expect(run).toContain('`[autonomy]`');
    // The launch-cleanup reminder.
    for (const item of ['Wipe the test data', 'Turn off the bot sandbox', 'Rotate the service-role key', 'post-launch dev setup', 'dress rehearsal']) {
      expect(run).toContain(item);
    }
  });
});
