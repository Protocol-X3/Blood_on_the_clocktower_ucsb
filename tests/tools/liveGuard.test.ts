// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { liveDataRefusal } from '../support/liveGuard.ts';

describe('live-data guard', () => {
  it('QA-12: tests may create data on a local (Docker) Supabase', () => {
    expect(liveDataRefusal('http://127.0.0.1:54321', undefined)).toBeNull();
    expect(liveDataRefusal('http://localhost:54321', undefined)).toBeNull();
    expect(liveDataRefusal('http://[::1]:54321', undefined)).toBeNull();
  });

  it('QA-12: …but not on the cloud project, unless ALLOW_LIVE_TEST_DATA=1', () => {
    expect(liveDataRefusal('https://abcdefgh.supabase.co', undefined)).toMatch(/live Supabase project/);
    expect(liveDataRefusal('https://abcdefgh.supabase.co', '0')).toMatch(/ALLOW_LIVE_TEST_DATA=1/);
    expect(liveDataRefusal('https://localhost.evil.example', undefined)).not.toBeNull();
    expect(liveDataRefusal('', undefined)).toMatch(/unset Supabase URL/);
    expect(liveDataRefusal('https://abcdefgh.supabase.co', '1')).toBeNull();
  });

  it('QA-12: the guard runs wherever tests create accounts', () => {
    expect(readFileSync('tests/support/users.ts', 'utf8')).toMatch(/export async function poolUser\(.*\): Promise<TestUser> \{\n\s*assertTestDatabase\(\);/);
    expect(readFileSync('tests/integration/supabase.test.ts', 'utf8')).toMatch(/assertTestDatabase\(\);\n\s*const client = createClient/);
  });
});
