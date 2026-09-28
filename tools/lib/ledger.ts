// QA-08: a committed ledger of how many test files name each rule / criterion ID.
// Counts may only grow, and the ledger must match the tests in the same commit.
import { CRITERION_ID, RULE_ID } from './ids.ts';

export type Ledger = Record<string, number>;

/** Counts, for each ID, the number of test cases that name it (one per line mentioning it). */
export function countIds(files: { text: string }[]): Ledger {
  const counts: Ledger = {};
  for (const { text } of files) {
    for (const line of text.split(/\r?\n/)) {
      const ids = new Set([
        ...[...line.matchAll(new RegExp(RULE_ID.source, 'g'))].map((m) => m[1]!),
        ...[...line.matchAll(new RegExp(CRITERION_ID.source, 'g'))].map((m) => m[1]!),
      ]);
      for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

export interface LedgerProblems {
  outdated: string[]; // committed ledger doesn't match the current tests
  decreased: string[]; // an ID has fewer tests than on the baseline (main)
}

export function compareLedger(current: Ledger, committed: Ledger, baseline: Ledger | null): LedgerProblems {
  const ids = new Set([...Object.keys(current), ...Object.keys(committed)]);
  const outdated = [...ids]
    .filter((id) => (current[id] ?? 0) !== (committed[id] ?? 0))
    .map((id) => `${id}: tests=${current[id] ?? 0}, ledger=${committed[id] ?? 0}`);
  const decreased = baseline
    ? Object.keys(baseline)
        .filter((id) => (committed[id] ?? 0) < baseline[id]!)
        .map((id) => `${id}: ${baseline[id]} → ${committed[id] ?? 0}`)
    : [];
  return { outdated, decreased };
}
