// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readTestFiles } from '../../tools/lib/files.ts';
import { findSkippedTests } from '../../tools/lib/noSkip.ts';

// Offending snippets are built at runtime so this file doesn't trip the scanner itself.
const call = (fn: string, mod: string) => `${fn}.${mod}('x', () => {})`;

describe('no skipped or focused tests', () => {
  it.each([
    call('it', 'skip'),
    call('it', 'only'),
    call('test', 'skip'),
    call('describe', 'only'),
    call('test', 'fixme'),
    call('it', 'todo'),
    `${'x'}it('x', () => {})`,
  ])('QA-04 · M0.9: flags %s', (line) => {
    expect(findSkippedTests([{ path: 'a.test.ts', text: `ok\n${line}` }])).toEqual([
      { path: 'a.test.ts', line: 2, text: line },
    ]);
  });

  it('QA-04: ordinary tests and the words in prose are fine', () => {
    const text = "it('skips nothing', () => {})\ntest('only once', () => {})\ndescribe('x', () => {})";
    expect(findSkippedTests([{ path: 'a.test.ts', text }])).toEqual([]);
  });

  it('QA-04: the real test suite contains no skipped or focused tests', () => {
    expect(findSkippedTests(readTestFiles())).toEqual([]);
  });
});
