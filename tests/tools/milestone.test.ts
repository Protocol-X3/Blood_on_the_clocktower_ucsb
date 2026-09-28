// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkBranchProtection, REQUIRED_CHECKS } from '../../tools/lib/branchProtection.ts';
import { certificationProblems, evaluateCriteria, fromPlaywrightJson, fromTap, fromVitestJson } from '../../tools/lib/milestone.ts';

const m = (x: string) => `M${x}`;

describe('milestone check', () => {
  it('QA-09 · M0.9: a criterion needs at least one passing test and no failing one', () => {
    const results = [
      { title: `${m('9.1')}: proven`, status: 'passed' as const },
      { title: `${m('9.2')}: broken`, status: 'failed' as const },
      { title: `${m('9.2')}: other`, status: 'passed' as const },
      { title: `${m('9.10')}: not 9.1`, status: 'passed' as const },
    ];
    expect(evaluateCriteria([m('9.1'), m('9.2'), m('9.3')], results)).toEqual([
      { id: m('9.1'), passed: 1, failed: 0, ok: true },
      { id: m('9.2'), passed: 1, failed: 1, ok: false },
      { id: m('9.3'), passed: 0, failed: 0, ok: false },
    ]);
  });

  it('QA-09: reads Vitest, Playwright and TAP results', () => {
    expect(
      fromVitestJson({ testResults: [{ assertionResults: [{ fullName: 'a b', status: 'passed' }, { title: 'c', status: 'failed' }, { status: 'skipped' }] }] }),
    ).toEqual([
      { title: 'a b', status: 'passed' },
      { title: 'c', status: 'failed' },
      { title: '', status: 'skipped' },
    ]);
    const pw = {
      suites: [
        {
          title: 'ui.spec.ts',
          specs: [{ title: 'works', tests: [{ projectName: 'phone', status: 'expected' }, { projectName: 'tablet', status: 'unexpected' }] }],
          suites: [{ title: 'inner', specs: [{ title: 'flaky', tests: [{ projectName: 'phone', status: 'flaky' }] }] }],
        },
      ],
    };
    expect(fromPlaywrightJson(pw)).toEqual([
      { title: 'ui.spec.ts › works › [phone]', status: 'passed' },
      { title: 'ui.spec.ts › works › [tablet]', status: 'failed' },
      { title: 'ui.spec.ts › inner › flaky › [phone]', status: 'passed' },
    ]);
    expect(fromTap(['1..2', 'ok 1 - a: fine', 'not ok 2 - b: bad', '# diag'])).toEqual([
      { title: 'a: fine', status: 'passed' },
      { title: 'b: bad', status: 'failed' },
    ]);
  });

  it('QA-11 · M0.9: a milestone is certified only with its report and its tag', () => {
    expect(certificationProblems('M3', { report: true, tag: true })).toEqual([]);
    expect(certificationProblems('M3', { report: false, tag: false })).toEqual([
      'missing report docs/reports/M3.md',
      'missing git tag m3-done',
    ]);
  });

  it('QA-10 · M0.9: main must require both CI checks, for admins too', () => {
    const good = { required_status_checks: { strict: true, contexts: REQUIRED_CHECKS }, enforce_admins: { enabled: true } };
    expect(checkBranchProtection(good)).toEqual([]);
    expect(checkBranchProtection(null)).toEqual(['main has no required status checks']);
    expect(
      checkBranchProtection({ required_status_checks: { checks: [{ context: 'Checks' }] }, enforce_admins: { enabled: false } }),
    ).toEqual(['required check missing: Full stack', 'admins can bypass the required checks']);
  });
});
