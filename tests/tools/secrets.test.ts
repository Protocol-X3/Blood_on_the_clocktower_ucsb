// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ROOT } from '../../tools/lib/files.ts';
import { scanForSecrets } from '../../tools/lib/secrets.ts';

// Fake secrets are assembled at runtime so this file never contains one literally.
const fakeSecretKey = ['sb', 'secret', 'abcdefghijklmnopqrstuvwxyz0123'].join('_');
const fakeDbUrl = `postgresql://postgres.ref:${'hunter2hunter2'}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`;
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (role: string) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role, iss: 'supabase' })}.c2lnbmF0dXJlc2lnbmF0dXJl`;

describe('secret scanner', () => {
  it('SEC-02: finds a secret key, a DB password URL and a service_role JWT in built files', () => {
    const findings = scanForSecrets([
      { path: 'dist/a.js', text: `const k="${fakeSecretKey}"` },
      { path: 'dist/b.js', text: `fetch("${fakeDbUrl}")` },
      { path: 'dist/c.js', text: `const t="${jwt('service_role')}"` },
    ]);
    expect(findings.map((f) => f.kind)).toEqual(['Supabase secret key', 'Postgres URL with password', 'service_role JWT']);
  });

  it('SEC-03: documentation placeholders in database URLs are not secrets', () => {
    const docs = ['password', '[YOUR-PASSWORD]', '<password>', '${DB_PASSWORD}']
      .map((pw) => `postgresql://user:${pw}@host:5432/postgres`)
      .join('\n');
    expect(scanForSecrets([{ path: 'docs/setup.md', text: docs }])).toEqual([]);
  });

  it('SEC-02: the public anon JWT and publishable key are not secrets', () => {
    const publishable = ['sb', 'publishable', 'abcdefghijklmnopqrstuvwxyz'].join('_');
    expect(scanForSecrets([{ path: 'dist/a.js', text: `"${jwt('anon')}" "${publishable}"` }])).toEqual([]);
  });

  it('SEC-03: finds literal values such as the admin email, without reporting the value', () => {
    const email = ['someone', 'example.com'].join('@');
    const findings = scanForSecrets([{ path: 'docs/x.md', text: `contact ${email}` }], [{ name: 'ADMIN_EMAIL', value: email }]);
    expect(findings).toEqual([{ path: 'docs/x.md', kind: 'value of ADMIN_EMAIL' }]);
    expect(JSON.stringify(findings)).not.toContain(email);
  });

  it('SEC-03: .env files are git-ignored, except .env.example', () => {
    const ignored = (f: string) => {
      try {
        execFileSync('git', ['check-ignore', '-q', f], { cwd: ROOT });
        return true;
      } catch {
        return false;
      }
    };
    expect(ignored('.env')).toBe(true);
    expect(ignored('.env.local')).toBe(true);
    expect(ignored('.env.production.local')).toBe(true);
    expect(ignored('.env.example')).toBe(false);
  });
});
