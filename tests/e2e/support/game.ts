// A running game for E2E tests: a DM, five seated players and, optionally, phones.
import { devices, type Browser, type Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../src/services/database.types.ts';
import { admin, clientFor, type TestUser } from '../../support/users.ts';
import { expect, otherBrowser } from './session.ts';

export type Client = SupabaseClient<Database>;
type Users = { make: (o?: object) => Promise<TestUser> };

// Seat 3 is the Drunk, shown as the Empath.
export const FIVE = [{ role: 'washerwoman' }, { role: 'chef' }, { role: 'drunk', shown: 'empath' }, { role: 'poisoner' }, { role: 'imp' }];

export interface Live {
  code: string;
  roomId: string;
  gameId: string;
  dm: TestUser;
  dmc: Client;
  players: TestUser[];
  clients: Client[];
  phones: Page[];
}

/** A running 5-seat game (第1夜), started through the API; the first `phones` players watch on phones. */
export async function liveGame(users: Users, browser: Browser, phones = 1): Promise<Live> {
  const dm = await users.make({ level: 'dm_eligible' });
  const dmc = await clientFor(dm);
  const { data: tb } = await admin.from('roles').select('id').eq('edition', 'tb');
  const { data: scriptId } = await dmc.rpc('save_script', {
    p_script: null as unknown as string,
    p_name: `暗流涌动${Date.now() % 100000}`,
    p_author: '',
    p_roles: tb!.map((r) => r.id),
  });
  const { data: code } = await dmc.rpc('create_room', { p_seat_count: 5 });
  const roomId = (await dmc.rpc('join_room', { p_code: code! })).data!;
  const players: TestUser[] = [];
  const clients: Client[] = [];
  for (let seat = 1; seat <= 5; seat += 1) {
    const p = await users.make();
    const c = await clientFor(p);
    await c.rpc('join_room', { p_code: code! });
    expect((await c.rpc('take_seat', { p_room: roomId, p_seat: seat })).error).toBeNull();
    players.push(p);
    clients.push(c);
  }
  const { data: gameId } = await dmc.rpc('start_setup', {
    p_room: roomId,
    p_script: scriptId!,
    p_mode: 'manual',
  });
  expect((await dmc.rpc('set_composition', { p_game: gameId!, p_roles: FIVE })).error).toBeNull();
  for (const [i, r] of FIVE.entries())
    expect(
      (
        await dmc.rpc('assign_seat', {
          p_game: gameId!,
          p_seat: i + 1,
          p_role: r.role,
        })
      ).error,
    ).toBeNull();
  expect((await dmc.rpc('start_game', { p_game: gameId! })).error).toBeNull();
  const pages: Page[] = [];
  for (let i = 0; i < phones; i += 1) {
    const page = await otherBrowser(browser, players[i]!, {
      ...devices['Pixel 7'],
    });
    await page.goto(`/room/${code}`);
    pages.push(page);
  }
  return {
    code: code!,
    roomId,
    gameId: gameId!,
    dm,
    dmc,
    players,
    clients,
    phones: pages,
  };
}

export async function closeAll(t: Live) {
  for (const p of t.phones) await p.context().close();
}

export const rpc = async (c: Client, fn: string, args: object) => {
  const { error } = await (c.rpc as (f: string, a: object) => PromiseLike<{ error: { message: string } | null }>)(fn, args);
  expect(error?.message ?? null).toBeNull();
};

