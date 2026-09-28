import { devices, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { admin, clientFor, type TestUser } from '../support/users.ts';
import { expect, otherBrowser, signIn, test } from './support/session.ts';

// DM screens on the tablet profile only; the players' side uses a phone-sized browser plus API clients.
// Serial: the tests reuse this worker's pool slots (up to 16 users each).
test.describe.configure({ mode: 'serial' });

// Recommended Trouble Brewing compositions (SETUP-01): [townsfolk, outsider, minion, demon].
const TOWNSFOLK = ['洗衣妇', '图书管理员', '调查员', '厨师', '共情者', '占卜师', '送葬者', '僧侣', '守鸦人'];
const OUTSIDERS = ['管家', '酒鬼'];
const MINIONS = ['投毒者', '间谍', '男爵'];
function composition(n: 5 | 15): string[] {
  return n === 5 ? ['洗衣妇', '厨师', '酒鬼', '投毒者', '小恶魔'] : [...TOWNSFOLK, ...OUTSIDERS, ...MINIONS, '小恶魔'];
}

interface Table {
  code: string;
  script: string;
  roomId: string;
  dm: TestUser;
  phonePlayer: Page;
  apiPlayers: Awaited<ReturnType<typeof clientFor>>[];
}

/** A room with a DM, a Trouble Brewing script, and n seated players: seat 1 in a phone browser, the rest via the API. */
async function table(
  n: number,
  users: { make: (o?: object) => Promise<TestUser> },
  browser: import('@playwright/test').Browser,
  opts: { offline?: boolean } = {},
): Promise<Table> {
  const dm = await users.make({ level: 'dm_eligible' });
  const dmc = await clientFor(dm);
  const { data: tb } = await admin.from('roles').select('id').eq('edition', 'tb');
  const script = `暗流涌动${Date.now() % 100000}`;
  await dmc.rpc('save_script', { p_script: null as unknown as string, p_name: script, p_author: '', p_roles: tb!.map((r) => r.id) });
  const { data: code } = await dmc.rpc('create_room', { p_seat_count: n });
  const roomId = (await dmc.rpc('join_room', { p_code: code! })).data!;
  const phoneUser = await users.make();
  const pc = await clientFor(phoneUser);
  await pc.rpc('join_room', { p_code: code! });
  await pc.rpc('take_seat', { p_room: roomId, p_seat: 1 });
  const apiPlayers = [];
  for (let seat = 2; seat <= n; seat += 1) {
    const c = await clientFor(await users.make());
    await c.rpc('join_room', { p_code: code! });
    await c.rpc('take_seat', { p_room: roomId, p_seat: seat });
    apiPlayers.push(c);
  }
  const phonePlayer = await otherBrowser(browser, phoneUser, { ...devices['Pixel 7'] });
  // "offline": no live updates reach this player's screen, so it can be deliberately stale.
  if (opts.offline) await phonePlayer.routeWebSocket(/realtime/, () => undefined);
  await phonePlayer.goto(`/room/${code}`);
  return { code: code!, script, roomId, dm, phonePlayer, apiPlayers };
}

async function startSetup(page: Page, script: string, mode: '抽卡' | '手动分配') {
  await page.getByRole('button', { name: '开始配置对局' }).click();
  await page.getByLabel('剧本').selectOption({ label: script });
  await page.getByRole('radio', { name: new RegExp(mode) }).check();
  await page.getByRole('button', { name: '下一步' }).click();
  await expect(page.getByTestId('setup-wizard')).toBeVisible();
}

async function pickComposition(page: Page, roles: string[]) {
  const script = page.getByRole('region', { name: '剧本角色' });
  for (const r of roles) await script.getByRole('button', { name: r, exact: true }).click();
  await expect(page.getByTestId('composition-count')).toHaveText('人数已齐');
}

for (const n of [5, 15] as const) {
  test(`M2.4 · SETUP-06 · SETUP-08 · SETUP-09 · SETUP-10: manual assignment with ${n} players, through to 开始游戏`, async ({ page, browser, users }, info) => {
    test.slow(n === 15, 'fifteen users and many round trips to the cloud database');
    const t = await table(n, users, browser);
    await signIn(page, t.dm);
    await page.goto(`/room/${t.code}`);
    await startSetup(page, t.script, '手动分配');
    const roles = composition(n);
    await pickComposition(page, roles);
    await page.getByLabel('酒鬼 展示为').selectOption({ label: '共情者' });
    await page.getByRole('button', { name: '下一步' }).click();

    // Assign in order; seat 1 (the phone player) gets the Drunk, shown as the Empath.
    const order = ['酒鬼', ...roles.filter((r) => r !== '酒鬼')];
    for (let seat = 1; seat <= n; seat += 1) {
      await page.getByLabel(`${seat}号的角色`, { exact: true }).selectOption({ label: order[seat - 1] === '酒鬼' ? '酒鬼（展示：共情者）' : order[seat - 1]! });
    }
    await expect(t.phonePlayer.getByRole('status')).toContainText('说书人正在配置对局');
    await page.getByRole('button', { name: '开始游戏' }).click();

    // SETUP-10: the first night; the player sees their shown role, never the actual one.
    await expect(t.phonePlayer.getByRole('heading', { name: '第1夜' })).toBeVisible({ timeout: 5000 });
    await expect(t.phonePlayer.getByTestId('role-card')).toContainText('共情者');
    await expect(t.phonePlayer.getByTestId('role-card')).not.toContainText('酒鬼');
    await expect(page.getByTestId('dm-seat-1')).toContainText('酒鬼');
    await expect(page.getByTestId('dm-seat-1')).toContainText('展示：共情者');
    if (n === 15) {
      mkdirSync('docs/reports/M2', { recursive: true });
      await page.screenshot({ path: `docs/reports/M2/dm-started-${info.project.name}.png`, fullPage: true });
      // Let the card finish flipping before the picture.
      await t.phonePlayer.getByTestId('role-card').evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
      await expect(async () => {
        const a = await t.phonePlayer.getByTestId('role-card').boundingBox();
        await t.phonePlayer.waitForTimeout(150);
        expect(await t.phonePlayer.getByTestId('role-card').boundingBox()).toEqual(a);
      }).toPass();
      await t.phonePlayer.screenshot({ path: 'docs/reports/M2/player-role-card-phone.png' });
    }
    await t.phonePlayer.context().close();
  });

  test(`M2.4 · DRAW-01 · DRAW-04 · DRAW-05 · SECRET-04: card draw with ${n} players, through to 开始游戏`, async ({ page, browser, users }, info) => {
    test.slow(n === 15, 'fifteen users and many round trips to the cloud database');
    const t = await table(n, users, browser);

    // SECRET-04: record everything the phone player's browser receives from the database.
    const leaks: string[] = [];
    t.phonePlayer.on('response', async (res) => {
      const u = res.url();
      if (!/\/rest\/v1\/(seat_roles|game_composition|draw_cards|seat_shown_roles)/.test(u)) return;
      const body = await res.json().catch(() => null);
      if (!Array.isArray(body)) return;
      if (/seat_shown_roles/.test(u)) {
        if (body.some((row: { seat: number }) => row.seat !== 1)) leaks.push(`${u}: another seat's shown role`);
      } else if (body.length > 0) leaks.push(`${u}: ${body.length} secret rows`);
    });
    // Realtime: only change events carry rows. The join reply also names the subscribed
    // tables, so match on the event, not on the table name alone.
    t.phonePlayer.on('websocket', (ws) =>
      ws.on('framereceived', (f) => {
        const text = typeof f.payload === 'string' ? f.payload : '';
        if (!text.includes('postgres_changes')) return;
        let msg: unknown;
        try {
          msg = JSON.parse(text);
        } catch {
          return;
        }
        // Phoenix v1 frames are objects, v2 frames are [join_ref, ref, topic, event, payload].
        const [event, payload] = Array.isArray(msg)
          ? [msg[3], msg[4]]
          : [(msg as { event?: unknown }).event, (msg as { payload?: unknown }).payload];
        if (event !== 'postgres_changes') return;
        const data = (payload as { data?: { table?: string; record?: { seat?: number } } }).data;
        if (!data) return;
        if (['seat_roles', 'game_composition', 'draw_cards'].includes(data.table ?? '')) leaks.push(`realtime ${data.table} row: ${text}`);
        else if (data.table === 'seat_shown_roles' && data.record?.seat !== undefined && data.record.seat !== 1) leaks.push(`realtime seat_shown_roles for seat ${data.record.seat}`);
      }),
    );

    await signIn(page, t.dm);
    await page.goto(`/room/${t.code}`);
    await startSetup(page, t.script, '抽卡');
    await pickComposition(page, composition(n));
    await page.getByRole('button', { name: '下一步' }).click();
    await expect(t.phonePlayer.getByRole('status')).toContainText('等待说书人发牌');
    await page.getByRole('button', { name: '发牌' }).click();

    // The phone player draws a card and sees their role at once (DRAW-04), with the flip.
    await t.phonePlayer.getByRole('button', { name: /抽取第 \d+ 张牌/ }).first().click();
    await expect(t.phonePlayer.getByTestId('role-card')).toBeVisible();
    await expect(t.phonePlayer.getByText('请勿向他人展示')).toBeVisible();
    // DRAW-05: the DM sees it live.
    await expect(page.getByTestId('assign-seat-1')).not.toContainText('未抽卡', { timeout: 3000 });

    // Everyone else draws through the API, taking whichever card is still free.
    const gameId = (await t.apiPlayers[0]!.from('games').select('id').eq('room_id', t.roomId).neq('status', 'ended').single()).data!.id;
    for (const c of t.apiPlayers) {
      for (let card = 1; card <= n; card += 1) {
        const { error } = await c.rpc('draw_card', { p_game: gameId, p_card: card });
        if (!error) break;
        expect(['CARD_TAKEN']).toContain(error.message);
      }
    }
    await expect(page.getByRole('list', { name: '座位角色' })).not.toContainText('未抽卡', { timeout: 5000 });
    if (n === 5) {
      mkdirSync('docs/reports/M2', { recursive: true });
      await page.screenshot({ path: `docs/reports/M2/dm-draw-${info.project.name}.png`, fullPage: true });
    }
    await page.getByRole('button', { name: '开始游戏' }).click();
    await expect(t.phonePlayer.getByRole('heading', { name: '第1夜' })).toBeVisible({ timeout: 5000 });
    await t.phonePlayer.reload();
    await expect(t.phonePlayer.getByTestId('role-card')).toBeVisible();
    expect(leaks).toEqual([]);
    await t.phonePlayer.context().close();
  });
}

test('SETUP-07 · SETUP-06: counts off the recommendation only warn; the DM can go back to the basics step', async ({ page, browser, users }) => {
  const t = await table(5, users, browser);
  await signIn(page, t.dm);
  await page.goto(`/room/${t.code}`);
  await startSetup(page, t.script, '手动分配');
  await pickComposition(page, ['洗衣妇', '厨师', '僧侣', '投毒者', '小恶魔'].slice(0, 2).concat(['管家', '酒鬼', '小恶魔']));
  await expect(page.getByRole('status').filter({ hasText: '与建议的阵营人数不同' })).toBeVisible();
  await expect(page.getByRole('button', { name: '下一步' })).toBeEnabled();
  await page.getByRole('button', { name: '返回基础设置' }).click();
  await expect(page.getByRole('button', { name: '开始配置对局' })).toBeVisible();
  await t.phonePlayer.context().close();
});

test('DRAW-03: a card another player took shows 已被抽走，请重选', async ({ page, browser, users }) => {
  const t = await table(5, users, browser, { offline: true });
  await signIn(page, t.dm);
  await page.goto(`/room/${t.code}`);
  await startSetup(page, t.script, '抽卡');
  await pickComposition(page, composition(5));
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '发牌' }).click();
  await t.phonePlayer.reload();
  await expect(t.phonePlayer.getByRole('button', { name: '抽取第 2 张牌' })).toBeVisible();
  // Seat 2 takes card 2 while the phone player's screen still shows it face down.
  const gameId = (await t.apiPlayers[0]!.from('games').select('id').eq('room_id', t.roomId).neq('status', 'ended').single()).data!.id;
  expect((await t.apiPlayers[0]!.rpc('draw_card', { p_game: gameId, p_card: 2 })).error).toBeNull();
  await t.phonePlayer.getByRole('button', { name: '抽取第 2 张牌' }).click();
  await expect(t.phonePlayer.getByRole('alert')).toHaveText('已被抽走，请重选');
  await expect(t.phonePlayer.getByTestId('card-2')).toContainText('2号已抽');
  // …and can pick another card.
  await t.phonePlayer.getByRole('button', { name: '抽取第 3 张牌' }).click();
  await expect(t.phonePlayer.getByTestId('role-card')).toBeVisible();
  await t.phonePlayer.context().close();
});
