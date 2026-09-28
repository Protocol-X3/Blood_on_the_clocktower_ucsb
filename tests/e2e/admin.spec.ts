import { mkdirSync } from 'node:fs';
import { botSandbox } from '../support/botSandbox.ts';
import { admin, clientFor, uniqueNickname } from '../support/users.ts';
import { expect, otherBrowser, signIn, test } from './support/session.ts';

// Only one admin can exist, and the bot-sandbox switch is global too: these run in sequence,
// on the tablet profile only (see playwright.config.ts). Local runs share the live database,
// so the switch goes back to whatever the admin had chosen.
test.describe.configure({ mode: 'serial' });
let sandboxBefore = false;
test.beforeAll(async () => {
  sandboxBefore = await botSandbox();
});
test.afterAll(async () => {
  await botSandbox(sandboxBefore);
});

test('PERM-06 · M1.5: the admin grants and revokes DM-eligible on /admin', async ({ page, users }, info) => {
  const target = await users.make();
  await signIn(page, await users.make({ level: 'admin' }));
  await page.goto('/admin');
  const row = page.getByTestId(`user-${target.nickname}`);
  await expect(row).toContainText('玩家');
  await row.getByRole('button', { name: '授予说书人资格' }).click();
  await expect(row).toContainText('可担任说书人');
  mkdirSync('docs/reports/M1', { recursive: true });
  await page.screenshot({ path: `docs/reports/M1/admin-${info.project.name}.png`, fullPage: true });
  await row.getByRole('button', { name: '取消资格' }).click();
  await expect(row).toContainText('玩家');
});

test('PERM-06: guests are not listed, and anyone but the admin sees 没有权限', async ({ page, users }) => {
  const guest = await users.make({ guest: true });
  const player = await users.make();
  await signIn(page, await users.make({ level: 'admin' }));
  await page.goto('/admin');
  await expect(page.getByTestId(`user-${player.nickname}`)).toBeVisible();
  await expect(page.getByTestId(`user-${guest.nickname}`)).toHaveCount(0);

  const playerPage = await page.context().browser()!.newPage();
  await signIn(playerPage, player);
  await playerPage.goto('/admin');
  await expect(playerPage.getByRole('heading', { name: '没有权限' })).toBeVisible();
  await playerPage.close();
});

test('PERM-07 · M1.5: a newly granted user can create rooms right away, without signing in again', async ({ page, browser, users }) => {
  const target = await users.make();
  const targetPage = await otherBrowser(browser, target);
  await targetPage.goto('/');
  await expect(targetPage.getByRole('button', { name: '创建房间' })).toHaveCount(0);

  await signIn(page, await users.make({ level: 'admin' }));
  await page.goto('/admin');
  await page.getByTestId(`user-${target.nickname}`).getByRole('button', { name: '授予说书人资格' }).click();
  await expect(targetPage.getByRole('button', { name: '创建房间' })).toBeVisible({ timeout: 5000 });
  await targetPage.context().close();
});

test('HIST-06: the admin deletes an account from /admin, after confirming', async ({ page, users }) => {
  // A throwaway account: deletion is permanent, so not one from the reusable pool.
  const { data } = await admin.auth.admin.createUser({ email: `e2e-del-${Date.now()}@test.botc`, password: `pw-${Date.now()}-x`, email_confirm: true });
  const nickname = uniqueNickname('删');
  await admin.from('profiles').update({ nickname }).eq('id', data.user!.id);
  await signIn(page, await users.make({ level: 'admin' }));
  await page.goto('/admin');
  const row = page.getByTestId(`user-${nickname}`);
  await row.getByRole('button', { name: `删除账号 ${nickname}` }).click();
  const dialog = page.getByRole('dialog', { name: `删除账号：${nickname}` });
  await expect(dialog).toContainText('已删除用户');
  await dialog.getByRole('button', { name: '确认删除' }).click();
  await expect(page.getByRole('alert')).toHaveText(`已删除账号：${nickname}`);
  await expect(row).toHaveCount(0);
  expect((await admin.auth.admin.getUserById(data.user!.id)).data.user).toBeNull();
});

test('BOT-01: the bot sandbox is off until the admin switches it on under 管理; only then do DMs see the bot tools', async ({ page, browser, users }) => {
  await botSandbox(false);
  const dm = await users.make({ level: 'dm_eligible' });
  const { data: code } = await (await clientFor(dm)).rpc('create_room', { p_seat_count: 5 });
  const dmPage = await otherBrowser(browser, dm);
  await dmPage.goto(`/room/${code}`);
  await expect(dmPage.getByRole('region', { name: '说书人工具' })).toBeVisible();
  await expect(dmPage.getByRole('region', { name: '机器人沙盒' })).toHaveCount(0);

  await signIn(page, await users.make({ level: 'admin' }));
  await page.goto('/admin');
  const toggle = page.getByRole('switch', { name: '开启机器人沙盒' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await dmPage.reload();
  await expect(dmPage.getByRole('region', { name: '机器人沙盒' }).getByRole('button', { name: '填充机器人' })).toBeVisible();

  // Off again: the switch remembers, and the tools disappear.
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await dmPage.reload();
  await expect(dmPage.getByRole('region', { name: '说书人工具' })).toBeVisible();
  await expect(dmPage.getByRole('region', { name: '机器人沙盒' })).toHaveCount(0);
  await dmPage.context().close();
});

const TEN = ['洗衣妇', '图书管理员', '调查员', '厨师', '共情者', '占卜师', '送葬者', '投毒者', '间谍', '小恶魔'];

test('M3.6 · BOT-02: the DM fills nine seats with bots; they draw cards, and a vote circle completes with their votes', async ({
  page,
  users,
}, info) => {
  test.slow();
  await botSandbox(true);
  const dm = await users.make({ level: 'dm_eligible' });
  const dmc = await clientFor(dm);
  const { data: tb } = await admin.from('roles').select('id').eq('edition', 'tb');
  const script = `暗流涌动${Date.now() % 100000}`;
  await dmc.rpc('save_script', {
    p_script: null as unknown as string,
    p_name: script,
    p_author: '',
    p_roles: tb!.map((r) => r.id),
  });
  const { data: code } = await dmc.rpc('create_room', { p_seat_count: 10 });
  const roomId = (await dmc.rpc('join_room', { p_code: code! })).data!;
  const human = await users.make();
  const hc = await clientFor(human);
  await hc.rpc('join_room', { p_code: code! });
  await hc.rpc('take_seat', { p_room: roomId, p_seat: 1 });

  await signIn(page, dm);
  await page.goto(`/room/${code}`);
  const sandbox = page.getByRole('region', { name: '机器人沙盒' });
  await sandbox.getByRole('button', { name: '填充机器人' }).click();
  await expect(sandbox.getByRole('status')).toHaveText('已加入 9 个机器人');
  for (let seat = 2; seat <= 10; seat += 1) await expect(page.getByTestId(`seat-${seat}`)).toContainText(`机器人${seat}`);

  // Card draw: the bots draw by themselves; the human draws through the API.
  await page.getByRole('button', { name: '开始配置对局' }).click();
  await page.getByLabel('剧本').selectOption({ label: script });
  await page.getByRole('radio', { name: /抽卡/ }).check();
  await page.getByRole('button', { name: '下一步' }).click();
  const scriptRoles = page.getByRole('region', { name: '剧本角色' });
  for (const r of TEN) await scriptRoles.getByRole('button', { name: r, exact: true }).click();
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '发牌' }).click();
  const gameId = (await dmc.from('games').select('id').eq('room_id', roomId).neq('status', 'ended').single()).data!.id;
  await expect
    .poll(async () => (await admin.from('draw_slots').select('card_no').eq('game_id', gameId).not('taken_by_seat', 'is', null)).data!.length, {
      timeout: 20_000,
    })
    .toBe(9);
  const free = (await admin.from('draw_slots').select('card_no').eq('game_id', gameId).is('taken_by_seat', null)).data![0]!.card_no;
  expect((await hc.rpc('draw_card', { p_game: gameId, p_card: free })).error).toBeNull();
  await page.getByRole('button', { name: '开始游戏' }).click();

  // Day 1: a nomination; the bots raise hands at random, and the circle runs through them.
  await page.getByRole('button', { name: '进入第1天' }).click();
  await page.getByRole('tab', { name: '提名' }).click();
  await page.getByRole('combobox', { name: '提名者', exact: true }).selectOption({ index: 0 });
  await page.getByRole('combobox', { name: '被提名者' }).selectOption({ index: 1 });
  await page.getByRole('button', { name: '发起提名' }).click();
  await expect(page.getByRole('region', { name: '当前提名' })).toBeVisible();
  const nom = async () => (await admin.from('nominations').select('id, status, vote_count').eq('game_id', gameId).single()).data!;
  const botHands = async () =>
    (
      await admin
        .from('votes')
        .select('seat')
        .eq('nomination_id', (await nom()).id)
        .eq('raised', true)
        .gte('seat', 2)
    ).data!.length;
  await expect.poll(botHands, { timeout: 15_000 }).toBeGreaterThan(0);
  await page.getByLabel('指针速度').fill('500');
  await page.getByRole('button', { name: '开始计票' }).click();
  await expect(page.getByText('计票完成：')).toBeVisible({ timeout: 20_000 });
  const { data: votes } = await admin
    .from('votes')
    .select('seat, raised, locked')
    .eq('nomination_id', (await nom()).id);
  expect(votes!.every((v) => v.locked)).toBe(true);
  const botVotes = votes!.filter((v) => v.seat >= 2 && v.raised).length;
  expect(botVotes).toBeGreaterThan(0);
  expect((await nom()).vote_count).toBe(votes!.filter((v) => v.raised).length);
  if (info.project.name === 'tablet') {
    mkdirSync('docs/reports/M3', { recursive: true });
    await page.screenshot({
      path: 'docs/reports/M3/sandbox-vote-tablet.png',
      fullPage: true,
    });
  }
});
