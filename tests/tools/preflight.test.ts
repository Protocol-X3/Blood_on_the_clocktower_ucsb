// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkAuthSettings, checkEnv, formatChecks } from '../../tools/lib/preflight.ts';

const good = {
  VITE_SUPABASE_URL: 'https://abcdefgh.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: ['sb', 'publishable', 'xyz'].join('_'),
  SUPABASE_SERVICE_ROLE_KEY: ['sb', 'secret', 'topsecretvalue123'].join('_'),
  SUPABASE_DB_URL: `postgresql://postgres.abcdefgh:${'pw123456'}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
  ADMIN_EMAIL: ['owner', 'example.com'].join('@'),
};

describe('preflight', () => {
  it('QA-07 · M0.8: a complete, well-formed env passes every E0.3 check', () => {
    expect(checkEnv(good).every((c) => c.pass)).toBe(true);
  });

  it('QA-07 · M0.8: missing and malformed values fail with a hint', () => {
    const checks = checkEnv({ ...good, VITE_SUPABASE_URL: 'https://abcdefgh.supabase.co/rest/v1/', ADMIN_EMAIL: '' });
    expect(checks.filter((c) => !c.pass).map((c) => [c.label, c.hint])).toEqual([
      ['VITE_SUPABASE_URL', 'wrong format, expected https://<ref>.supabase.co, no path'],
      ['ADMIN_EMAIL', 'missing'],
    ]);
  });

  it('QA-07: a DB URL still holding the password placeholder fails', () => {
    const checks = checkEnv({ ...good, SUPABASE_DB_URL: 'postgresql://u:[YOUR-PASSWORD]@h:5432/postgres' });
    expect(checks.find((c) => c.label === 'SUPABASE_DB_URL')?.pass).toBe(false);
  });

  it('QA-07 · M0.8: the printed report never contains a value', () => {
    const report = formatChecks(checkEnv({ ...good, SUPABASE_DB_URL: 'not-a-url' }));
    for (const value of Object.values(good)) expect(report).not.toContain(value);
    expect(report).toContain('FAIL  [E0.3] SUPABASE_DB_URL');
  });

  it('QA-07: reads the sign-in providers from Supabase auth settings', () => {
    const on = checkAuthSettings({ external: { google: true, anonymous_users: true }, disable_signup: false });
    expect(on.every((c) => c.pass)).toBe(true);
    const off = checkAuthSettings({ external: { google: false } });
    expect(off.filter((c) => !c.pass).map((c) => c.label)).toEqual(['anonymous sign-ins enabled', 'Google provider enabled']);
    expect(checkAuthSettings(null).every((c) => c.pass)).toBe(false);
  });
});
