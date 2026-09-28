import type { Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { closeAll, liveGame, rpc } from './support/game.ts';
import { expect, signIn, test } from './support/session.ts';

// The DM's grimoire, on laptop / iPad sizes and a phone fallback.
test.describe.configure({ mode: 'serial' });

/** The centre of each seat token, in seat order. */
async function tokenCentres(page: Page, n: number) {
  const out: { x: number; y: number }[] = [];
  for (let seat = 1; seat <= n; seat += 1) {
    const box = (await page.getByTestId(`circle-seat-${seat}`).boundingBox())!;
    out.push({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }
  return out;
}

for (const size of [
  { width: 1024, height: 768 },
  { width: 1366, height: 1024 },
]) {
  test(`M4.3 · GRIM-01 · GRIM-02 · GRIM-04: the circle grimoire at ${size.width}×${size.height}, clockwise from the top, with everything about each seat`, async ({
    page,
    browser,
    users,
  }) => {
    const t = await liveGame(users, browser, 0);
    // Seat 2: poisoned and given a custom token; seat 4: dead and turned good; a day, for GRIM-04.
    await rpc(t.dmc, 'add_token', { p_game: t.gameId, p_seat: 2, p_kind: 'poisoned' });
    await rpc(t.dmc, 'add_token', { p_game: t.gameId, p_seat: 2, p_kind: 'custom', p_text: '红鲱鱼' });
    await rpc(t.dmc, 'kill_seat', { p_game: t.gameId, p_seat: 4, p_cause: 'night' });
    await rpc(t.dmc, 'set_alignment', { p_game: t.gameId, p_seat: 4, p_alignment: 'good' });
    await rpc(t.dmc, 'advance_phase', { p_game: t.gameId });
    await page.setViewportSize(size);
    await signIn(page, t.dm);
    await page.goto(`/room/${t.code}`);

    await expect(page.getByTestId('grimoire')).toHaveAttribute('data-layout', 'circle');
    // GRIM-04: dark by day too.
    await expect(page.getByTestId('game-theme')).toHaveAttribute('data-theme', 'grimoire');
    // GRIM-01: seat 1 at the top, then clockwise in seat order.
    const pts = await tokenCentres(page, 5);
    const cx = pts.reduce((a, p) => a + p.x, 0) / 5;
    const cy = pts.reduce((a, p) => a + p.y, 0) / 5;
    const angle = (p: { x: number; y: number }) => (Math.atan2(p.x - cx, -(p.y - cy)) * 180) / Math.PI;
    expect(Math.abs(angle(pts[0]!))).toBeLessThan(5);
    const clockwise = pts.map((p) => (angle(p) + 360) % 360);
    expect([...clockwise].sort((a, b) => a - b)).toEqual(clockwise);

    // GRIM-02: number, nickname, actual role, shown role, off-team alignment, death, ghost vote, tokens.
    const seat = (n: number) => page.getByTestId(`circle-seat-${n}`);
    await expect(seat(1)).toContainText(`1号 ${t.players[0]!.nickname}`);
    await expect(seat(1)).toContainText('洗衣妇');
    await expect(seat(3)).toContainText('酒鬼 · 展示：共情者');
    await expect(seat(4)).toContainText('投毒者');
    await expect(seat(4)).toContainText('善良');
    await expect(seat(4)).toContainText('夜间死亡 · 有幽灵票');
    await expect(seat(2).getByTestId('tokens-2')).toContainText('中毒');
    await expect(seat(2).getByTestId('tokens-2')).toContainText('红鲱鱼');
    await expect(seat(1)).not.toContainText('善良');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    mkdirSync('docs/reports/M4', { recursive: true });
    await page.screenshot({ path: `docs/reports/M4/grimoire-${size.width}x${size.height}.png`, fullPage: true });
  });
}

test('M4.3 · GRIM-01: on a phone, the grimoire is a list with no horizontal scroll', async ({ page, browser, users }) => {
  const t = await liveGame(users, browser, 0);
  await rpc(t.dmc, 'add_token', { p_game: t.gameId, p_seat: 5, p_kind: 'drunk' });
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, t.dm);
  await page.goto(`/room/${t.code}`);
  await expect(page.getByTestId('grimoire')).toHaveAttribute('data-layout', 'list');
  for (let n = 1; n <= 5; n += 1) await expect(page.getByTestId(`grimoire-seat-${n}`)).toContainText(`${n}号`);
  await expect(page.getByTestId('grimoire-seat-3')).toContainText('展示：共情者');
  await expect(page.getByTestId('grimoire-seat-5')).toContainText('醉酒');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'docs/reports/M4/grimoire-phone.png', fullPage: true });
});

test('GRIM-03 · TOKEN-01 · LOG-01 · LOG-03: the seat panel does everything for a seat; the log is filtered by seat and phase', async ({ page, browser, users }) => {
  const t = await liveGame(users, browser, 1);
  await signIn(page, t.dm);
  await page.goto(`/room/${t.code}`);
  await page.getByTestId('circle-seat-3').getByRole('button').click();
  const panel = page.getByTestId('seat-panel');
  await expect(panel).toContainText(`3号 ${t.players[2]!.nickname}`);

  // Tokens: 中毒, a script reminder, a custom one; remove one.
  await panel.getByRole('button', { name: '中毒' }).click();
  await panel.getByLabel('角色提示标记').selectOption({ label: '洗衣妇 · 镇民' });
  await panel.getByRole('button', { name: '添加', exact: true }).first().click();
  await panel.getByLabel('自定义标记').fill('九个字的标记太长了');
  await expect(panel.getByRole('button', { name: '添加', exact: true }).nth(1)).toBeDisabled();
  await panel.getByLabel('自定义标记').fill('守护');
  await panel.getByRole('button', { name: '添加', exact: true }).nth(1).click();
  await expect(page.getByTestId('tokens-3')).toContainText('中毒');
  await expect(page.getByTestId('tokens-3')).toContainText('镇民');
  await expect(page.getByTestId('tokens-3')).toContainText('守护');
  await panel.getByRole('button', { name: '移除标记 守护' }).click();
  await expect(page.getByTestId('tokens-3')).not.toContainText('守护');

  // Roles: the Drunk becomes a Librarian who is shown as the Librarian; alignment turns evil.
  await panel.getByLabel('真实角色').selectOption({ label: '图书管理员（镇民）' });
  await panel.getByLabel('展示角色').selectOption({ label: '图书管理员（镇民）' });
  await panel.getByRole('button', { name: '更改角色' }).click();
  await expect(page.getByTestId('circle-seat-3')).toContainText('图书管理员');
  await expect(page.getByTestId('circle-seat-3')).not.toContainText('展示：');
  await panel.getByRole('radio', { name: '邪恶' }).click();
  await expect(page.getByTestId('circle-seat-3')).toContainText('邪恶');

  // Log entries: one for seat 3 at night, one for the game by day; edit and delete.
  await panel.getByLabel('日志内容').fill('第一夜：得知 1号 是洗衣妇');
  await panel.getByRole('button', { name: '添加日志' }).click();
  await expect(panel.getByTestId('log-entry')).toContainText('第1夜');
  await panel.getByTestId('log-entry').getByRole('button', { name: '编辑' }).click();
  await panel.getByLabel('修改日志').fill('第一夜：得知 1号 或 2号 是洗衣妇');
  await panel.getByRole('button', { name: '保存' }).click();
  await expect(panel.getByTestId('log-entry')).toContainText('1号 或 2号');
  await page.getByRole('button', { name: '进入第1天' }).click();
  await expect(page.getByRole('heading', { name: '第1天' })).toBeVisible();
  await page.getByRole('tab', { name: '日志' }).click();
  const log = page.getByRole('region', { name: '说书人日志' });
  await log.getByLabel('日志内容').fill('白天：3号 声称自己是图书管理员');
  await log.getByRole('button', { name: '添加日志' }).click();
  await log.getByLabel('日志内容').fill('要删掉的记录');
  await log.getByRole('button', { name: '添加日志' }).click();
  await expect(log.getByTestId('log-entry')).toHaveCount(3);
  await log.getByTestId('log-entry').filter({ hasText: '要删掉的记录' }).getByRole('button', { name: '删除' }).click();
  await expect(log.getByTestId('log-entry')).toHaveCount(2);
  // LOG-03
  await log.getByLabel('按座位筛选').selectOption({ label: `3号 ${t.players[2]!.nickname}` });
  await expect(log.getByTestId('log-entry')).toHaveCount(1);
  await expect(log.getByTestId('log-entry')).toContainText('第1夜');
  await log.getByLabel('按座位筛选').selectOption({ label: '全部座位' });
  await log.getByLabel('按阶段筛选').selectOption({ label: '第1天' });
  await expect(log.getByTestId('log-entry')).toHaveCount(1);
  await expect(log.getByTestId('log-entry')).toContainText('整局');

  // GRIM-03: the player just sees their new shown role.
  const phone = t.phones[0]!;
  await rpc(t.dmc, 'set_seat_role', { p_game: t.gameId, p_seat: 1, p_actual: 'chef', p_shown: 'chef' });
  await expect(phone.getByRole('button', { name: /我的角色/ })).toContainText('厨师');
  await page.screenshot({ path: 'docs/reports/M4/seat-panel-tablet.png', fullPage: true });
  await closeAll(t);
});

test('TOKEN-02 · LOG-02 · M4.4 · GRIM-05: players never receive tokens or the log; afterwards the summary shows everything; the grimoire shows the same vote counts', async ({
  page,
  browser,
  users,
}) => {
  const t = await liveGame(users, browser, 1);
  const phone = t.phones[0]!;
  const leaks: string[] = [];
  phone.on('response', async (res) => {
    if (!/\/rest\/v1\/(grimoire_tokens|dm_log)/.test(res.url())) return;
    const body = await res.json().catch(() => null);
    if (Array.isArray(body) && body.length > 0) leaks.push(`${res.url()}: ${body.length} rows`);
  });
  phone.on('websocket', (ws) =>
    ws.on('framereceived', (f) => {
      const text = typeof f.payload === 'string' ? f.payload : '';
      // A deleted row's event carries only its id; anything with the token or log text is a leak.
      if (/"table":"(grimoire_tokens|dm_log)"/.test(text) && /"(label|body)":/.test(text)) leaks.push(`realtime: ${text.slice(0, 200)}`);
    }),
  );
  await phone.reload();
  const { data: tok } = await t.dmc.rpc('add_token', { p_game: t.gameId, p_seat: 1, p_kind: 'poisoned' });
  await rpc(t.dmc, 'add_log', { p_game: t.gameId, p_seat: 1, p_body: '1号 被下毒' });
  await rpc(t.dmc, 'remove_token', { p_token: tok! });
  await rpc(t.dmc, 'add_token', { p_game: t.gameId, p_seat: 2, p_kind: 'drunk' });
  await rpc(t.dmc, 'kill_seat', { p_game: t.gameId, p_seat: 5, p_cause: 'night' });

  // GRIM-05: during a vote, the grimoire's centre shows the players' counts.
  await rpc(t.dmc, 'advance_phase', { p_game: t.gameId });
  const { data: nom } = await t.dmc.rpc('open_nomination', { p_game: t.gameId, p_nominator: 1, p_nominee: 2 });
  await rpc(t.clients[2]!, 'set_hand', { p_nomination: nom!, p_raised: true });
  await rpc(t.clients[3]!, 'set_hand', { p_nomination: nom!, p_raised: true });
  await rpc(t.dmc, 'start_vote', { p_nomination: nom! });
  for (let i = 0; i < 3; i += 1) await rpc(t.dmc, 'advance_vote', { p_nomination: nom!, p_expected: i });
  await signIn(page, t.dm);
  await page.goto(`/room/${t.code}`);
  await expect(page.getByTestId('dm-vote-center')).toContainText('2 / 2');
  await expect(phone.getByTestId('vote-tally')).toContainText('2');
  await expect(phone.getByTestId('vote-tally')).toContainText('需 2 票');
  for (let i = 3; i < 5; i += 1) await rpc(t.dmc, 'advance_vote', { p_nomination: nom!, p_expected: i });
  await rpc(t.dmc, 'close_vote', { p_nomination: nom! });

  await rpc(t.dmc, 'end_game', { p_game: t.gameId, p_winner: 'evil' });
  await expect(phone).toHaveURL(new RegExp(`/room/${t.code}/summary$`));
  expect(leaks).toEqual([]);
  // M4.4 / LOG-02: roles, shown roles, alignments, deaths and the log.
  await expect(phone.getByTestId('winner')).toHaveText('邪恶阵营获胜');
  await expect(phone.getByTestId('summary-seat-3')).toContainText('展示：共情者');
  await expect(phone.getByTestId('summary-seat-4')).toContainText('邪恶');
  await expect(phone.getByTestId('summary-seat-5')).toContainText('第1夜 夜间死亡');
  await expect(phone.getByTestId('summary-log')).toContainText('1号 被下毒');
  await phone.screenshot({ path: 'docs/reports/M4/summary-with-log-phone.png', fullPage: true });
  await closeAll(t);
});
