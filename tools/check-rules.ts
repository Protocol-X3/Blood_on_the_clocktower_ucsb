// QA-05: every active rule in docs/rules has a test; no test names an unknown rule.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRuleFiles, readTestFiles, ROOT } from './lib/files.ts';
import { currentMilestone, inScope, parseRules, ruleCoverage } from './lib/ids.ts';

// Rules become required phase by phase: those of the current milestone and all earlier ones.
const current = currentMilestone(readFileSync(join(ROOT, 'docs', 'plan', 'roadmap.md'), 'utf8'));
const catalog = parseRules(readRuleFiles());
const report = ruleCoverage(catalog, readTestFiles(), (file) => inScope(file, current));
const required = [...catalog.active.values()].filter((f) => inScope(f, current)).length;

for (const id of catalog.duplicates) console.error(`✗ ${id} is defined more than once`);
for (const id of report.missing) console.error(`✗ ${id} (${catalog.active.get(id)}) has no test`);
for (const ref of report.unknown) console.error(`✗ unknown rule ${ref}`);

if (catalog.duplicates.length || report.missing.length || report.unknown.length) {
  console.error(`\n${report.missing.length} of ${required} required rules (phases M0–M${current ?? '5'}) have no test.`);
  process.exitCode = 1;
} else {
  console.log(`✓ all ${required} rules of phases M0–M${current ?? '5'} are covered by tests (${catalog.active.size} rules in the catalog)`);
}
