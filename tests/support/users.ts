// Test users for integration and E2E tests.
//
// Supabase rate-limits sign-ins per IP, so tests don't create and sign in fresh
// users each time. Instead they draw from a POOL of long-lived test accounts
// (emails e2e-pool-…@test.botc): each slot is created once, signed in at most
// once an hour (the session is cached on disk), and reset to a clean state
// every time a test takes it. Parallel workers use disjoint slots.
// Passwords are derived from the service-role key, so they never appear in the repo.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/services/database.types.ts';
import { assertTestDatabase } from './liveGuard.ts';

export const url = process.env.VITE_SUPABASE_URL!;
const publishable = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const admin: SupabaseClient<Database> = createClient<Database>(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type Level = 'player' | 'dm_eligible' | 'admin';

export interface TestUser {
  id: string;
  email: string;
  nickname: string | null;
}

export interface UserOptions {
  nickname?: string | null;
  level?: Level;
  guest?: boolean;
}

const CACHE_DIR = join(process.cwd(), 'node_modules', '.cache', 'botc-test-sessions', new URL(url).host);

let counter = 0;
/** A short unique nickname (≤ 12 characters). */
export function uniqueNickname(prefix = '测试'): string {
  counter += 1;
  return `${prefix}${randomUUID().slice(0, 4)}${counter}`.slice(0, 12);
}

function passwordFor(email: string): string {
  return `pw-${createHash('sha256').update(`${secret}:${email}`).digest('hex').slice(0, 32)}`;
}

interface Cached {
  id: string;
  session?: Session;
}

function readCache(email: string): Cached | null {
  const file = join(CACHE_DIR, `${email}.json`);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Cached) : null;
}

function writeCache(email: string, value: Cached): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, `${email}.json`), JSON.stringify(value));
}

async function ensureAccount(email: string): Promise<string> {
  const cached = readCache(email);
  if (cached) {
    const { data } = await admin.auth.admin.getUserById(cached.id);
    if (data.user) return cached.id;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password: passwordFor(email), email_confirm: true });
  let id = data.user?.id;
  if (!id) {
    // Already registered (e.g. the cache was cleared): find it.
    for (let page = 1; !id && page < 50; page += 1) {
      const list = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (!list.data.users.length) break;
      id = list.data.users.find((u) => u.email === email)?.id;
    }
    if (!id) throw error ?? new Error(`could not create ${email}`);
  }
  writeCache(email, { id });
  return id;
}

/** A session for the account, reusing the cached one while it has at least 15 minutes left. */
async function sessionFor(email: string): Promise<Session> {
  const cached = readCache(email);
  if (cached?.session?.expires_at && cached.session.expires_at * 1000 > Date.now() + 15 * 60_000) return cached.session;
  const client = createClient<Database>(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  // Supabase allows about 30 sign-ins per 5 minutes per IP: on the first run of the hour,
  // wait out the limit rather than fail (later runs reuse the cached sessions).
  for (let attempt = 0; ; attempt += 1) {
    const { data, error } = await client.auth.signInWithPassword({ email, password: passwordFor(email) });
    if (data.session) {
      writeCache(email, { id: data.user.id, session: data.session });
      return data.session;
    }
    if (!error || !/rate limit/i.test(error.message) || attempt >= 10) throw error ?? new Error(`sign-in failed for ${email}`);
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
}

/**
 * Takes pool slot `slot`, resets it (nickname, level, guest flag, no rooms or
 * memberships) and returns it. Callers must never use one slot in two places at once.
 */
export async function poolUser(slot: string, opts: UserOptions = {}): Promise<TestUser> {
  assertTestDatabase();
  const email = `e2e-pool-${slot}@test.botc`;
  const id = await ensureAccount(email);
  const level = opts.level ?? 'player';
  const nickname = opts.nickname === undefined ? uniqueNickname() : opts.nickname;

  await admin.from('rooms').update({ status: 'closed' }).eq('created_by', id).eq('status', 'open');
  await admin.from('room_members').delete().eq('user_id', id);
  if (level === 'admin') {
    // Only one admin may exist, so the test borrows the role. The E2E global
    // teardown (restoreRealAdmin) always hands it back to the configured admin account.
    await admin.from('profiles').update({ permission: 'player' }).eq('permission', 'admin').neq('id', id);
  }
  const { error } = await admin
    .from('profiles')
    .update({ nickname, permission: level, is_guest: opts.guest ?? false })
    .eq('id', id);
  if (error) throw new Error(`could not reset ${email}: ${error.message}`);
  return { id, email, nickname };
}

/** A supabase-js client acting as the user, with no further sign-in calls. */
export async function clientFor(user: TestUser): Promise<SupabaseClient<Database>> {
  const session = await sessionFor(user.email);
  return createClient<Database>(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
}

/** The session JSON supabase-js keeps in localStorage, and the key it uses. */
export async function storedSession(user: TestUser): Promise<{ key: string; value: string }> {
  const session = await sessionFor(user.email);
  return { key: `sb-${new URL(url).hostname.split('.')[0]}-auth-token`, value: JSON.stringify(session) };
}

/** Deletes users that aren't pool accounts (e.g. real anonymous guests created by a test). */
export async function deleteUsers(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => admin.auth.admin.deleteUser(id)));
}

/** Drops the cached session (e.g. after a test signed it out), forcing a fresh sign-in next time. */
export function forgetSession(user: TestUser): void {
  const cached = readCache(user.email);
  if (cached) writeCache(user.email, { id: cached.id });
}
