import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { supabaseCli } from '../../tools/lib/supabaseCli.ts';
import { assertTestDatabase } from '../support/liveGuard.ts';

const url = process.env.VITE_SUPABASE_URL!;
const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('Supabase project', () => {
  it('M0.4 · AUTH-02: the app reaches the Supabase project, which refuses anonymous (guest) sign-ins', async () => {
    assertTestDatabase();
    const client = createClient(url, publishable, { auth: { persistSession: false } });
    const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publishable } });
    expect(settings.ok).toBe(true);
    const body = (await settings.json()) as { external: { anonymous_users: boolean } };
    expect(body.external.anonymous_users).toBe(false);

    const { data, error } = await client.auth.signInAnonymously();
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
    // Nothing was created, so there is nothing to delete with the secret key.
    expect(secret).toBeTruthy();
  });

  it('M0.7: the Supabase CLI can reach the project database', () => {
    const r = supabaseCli(['migration', 'list', '--db-url', process.env.SUPABASE_DB_URL!]);
    expect(r.status, r.stderr).toBe(0);
  });
});
