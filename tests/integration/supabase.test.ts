import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { supabaseCli } from '../../tools/lib/supabaseCli.ts';
import { assertTestDatabase } from '../support/liveGuard.ts';

const url = process.env.VITE_SUPABASE_URL!;
const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;

describe('Supabase project', () => {
  it('M0.4: a guest can sign in anonymously and sign out', async () => {
    assertTestDatabase();
    const client = createClient(url, publishable, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signInAnonymously();
    expect(error).toBeNull();
    expect(data.user?.is_anonymous).toBe(true);
    const userId = data.user!.id;

    expect((await client.auth.signOut()).error).toBeNull();
    expect((await client.auth.getSession()).data.session).toBeNull();

    // Leave no test users behind.
    const admin = createClient(url, secret, { auth: { persistSession: false } });
    expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
  });

  it('M0.7: the Supabase CLI can reach the project database', () => {
    const r = supabaseCli(['migration', 'list', '--db-url', process.env.SUPABASE_DB_URL!]);
    expect(r.status, r.stderr).toBe(0);
  });
});
