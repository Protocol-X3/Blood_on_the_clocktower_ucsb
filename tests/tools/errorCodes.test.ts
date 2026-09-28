import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ERROR_MESSAGES } from '../../src/services/errors.ts';

describe('error codes in the database', () => {
  it('UI-03: every code a database function raises has a Chinese message', () => {
    const dir = 'supabase/migrations';
    const codes = new Set<string>();
    for (const f of readdirSync(dir)) {
      for (const m of readFileSync(`${dir}/${f}`, 'utf8').matchAll(/(?:fail\(|then |else )'([A-Z][A-Z_]+)'/g)) codes.add(m[1]!);
    }
    expect(codes.size).toBeGreaterThan(50);
    expect([...codes].filter((c) => !(c in ERROR_MESSAGES))).toEqual([]);
  });
});
