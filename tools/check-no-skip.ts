// QA-04: fail when any test is skipped or focused.
import { readTestFiles } from './lib/files.ts';
import { findSkippedTests } from './lib/noSkip.ts';

const findings = findSkippedTests(readTestFiles());
for (const f of findings) console.error(`✗ ${f.path}:${f.line}  ${f.text}`);
if (findings.length) {
  console.error('\nSkipped or focused tests are not allowed (QA-04).');
  process.exitCode = 1;
} else {
  console.log('✓ no skipped or focused tests');
}
