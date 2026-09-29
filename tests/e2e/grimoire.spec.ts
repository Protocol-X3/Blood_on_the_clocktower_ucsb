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

test('GRIM-03 · TOKEN-01 · LOG-01 · LOG-03: the seat panel does everything for a seat, its log row included; the 日志 tab shows one phase at a time', async ({ page, browser, users }) => {
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

  // GRIM-03 · LOG-01: the seat panel holds seat 3's row of the log; the full table shows the same cells.
  await panel.getByLabel('3号 角色设置').fill('以为自己是共情者');
  await panel.getByLabel('3号 第1夜').click();
  await panel.getByLabel('3号 第1夜').fill('得知 1号 是洗衣妇');
  await panel.getByLabel('3号 第1夜').press('Control+Enter');
  const sheet = page.getByRole('region', { name: '日志总表' });
  await expect(sheet.getByLabel('3号 角色设置')).toHaveValue('以为自己是共情者');
  await expect(sheet.getByLabel('3号 第1夜')).toHaveValue('得知 1号 是洗衣妇');
  // LOG-01: writing a cell again changes it.
  await sheet.getByLabel('3号 第1夜').fill('得知 1号 或 2号 是洗衣妇');
  await sheet.getByLabel('3号 第1夜').press('Control+Enter');
  await expect(panel.getByLabel('3号 第1夜')).toHaveValue('得知 1号 或 2号 是洗衣妇');

  await page.getByRole('button', { name: '进入第1天' }).click();
  await expect(page.getByRole('heading', { name: '第1天' })).toBeVisible();
  await page.getByRole('tab', { name: '日志' }).click();
  const log = page.getByRole('region', { name: '说书人日志' });
  // LOG-03: the current phase first, a box for every seat.
  await expect(log.getByRole('button', { name: /第1天/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(log.getByTestId('log-row')).toHaveCount(5);
  await log.getByLabel('3号 第1天').fill('白天：3号 声称自己是图书管理员');
  await log.getByLabel('3号 第1天').press('Control+Enter');
  await expect(sheet.getByLabel('3号 第1天')).toHaveValue('白天：3号 声称自己是图书管理员');
  // LOG-03: an earlier phase stays editable; clearing a cell empties it.
  await log.getByRole('button', { name: '第1夜' }).click();
  await expect(log.getByLabel('3号 第1夜')).toHaveValue('得知 1号 或 2号 是洗衣妇');
  await log.getByLabel('3号 第1夜').fill('');
  await log.getByLabel('3号 第1夜').press('Control+Enter');
  await expect(sheet.getByLabel('3号 第1夜')).toHaveValue('');
  await expect(sheet.getByLabel('3号 第1天')).toHaveValue('白天：3号 声称自己是图书管理员');

  // GRIM-03: the player just sees their new shown role.
  const phone = t.phones[0]!;
  await rpc(t.dmc, 'set_seat_role', { p_game: t.gameId, p_seat: 1, p_actual: 'chef', p_shown: 'chef' });
  // The card is face down (SECRET-05): the player taps it to see the new role.
  await expect(phone.getByTestId('role-hidden')).toBeVisible();
  await phone.getByTestId('role-hidden').click();
  await expect(phone.getByTestId('role-card')).toContainText('厨师');
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
  // Once the game ends, the log and tokens are the players' to read (LOG-02): only record until then.
  let running = true;
  phone.on('response', async (res) => {
    if (!running) return;
    if (!/\/rest\/v1\/(grimoire_tokens|dm_log_cells|dm_log_notes|dm_log_row_marks)/.test(res.url())) return;
    const body = await res.json().catch(() => null);
    if (Array.isArray(body) && body.length > 0) leaks.push(`${res.url()}: ${body.length} rows`);
  });
  phone.on('websocket', (ws) =>
    ws.on('framereceived', (f) => {
      if (!running) return;
      const text = typeof f.payload === 'string' ? f.payload : '';
      // A deleted row's event carries only its id; anything with the token or log text is a leak.
      if (/"table":"(grimoire_tokens|dm_log_cells|dm_log_notes|dm_log_row_marks)"/.test(text) && /"(label|body|mark)":/.test(text)) leaks.push(`realtime: ${text.slice(0, 200)}`);
    }),
  );
  await phone.reload();
  const { data: tok } = await t.dmc.rpc('add_token', { p_game: t.gameId, p_seat: 1, p_kind: 'poisoned' });
  await rpc(t.dmc, 'set_log_cell', { p_game: t.gameId, p_seat: 1, p_note: null, p_column: 'night', p_phase: 1, p_body: '1号 被下毒' });
  await rpc(t.dmc, 'mark_log_cells', { p_game: t.gameId, p_cells: [{ seat: 1, column: 'night', phase: 1 }], p_mark: 'violet' });
  const { data: note } = await t.dmc.rpc('add_log_note', { p_game: t.gameId, p_label: '整局' });
  await rpc(t.dmc, 'set_log_cell', { p_game: t.gameId, p_seat: null, p_note: note, p_column: 'setup', p_phase: null, p_body: '恶魔伪装：僧侣' });
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

  running = false;
  await rpc(t.dmc, 'end_game', { p_game: t.gameId, p_winner: 'evil' });
  await expect(phone).toHaveURL(new RegExp(`/room/${t.code}/summary$`));
  expect(leaks).toEqual([]);
  // M4.4 / LOG-02: roles, shown roles, alignments, deaths and the log, as the full table.
  await expect(phone.getByTestId('winner')).toHaveText('邪恶阵营获胜');
  await expect(phone.getByTestId('summary-seat-3')).toContainText('展示：共情者');
  await expect(phone.getByTestId('summary-seat-4')).toContainText('邪恶');
  await expect(phone.getByTestId('summary-seat-5')).toContainText('第1夜 夜间死亡');
  const summaryLog = phone.getByTestId('summary-log');
  await expect(summaryLog).toContainText('1号 被下毒');
  await expect(summaryLog).toContainText('恶魔伪装：僧侣');
  // LOG-02: read-only, with the colours: seat 1's cell violet, the evil rows red.
  await expect(summaryLog.locator('td[data-r="s1"][data-c="n1"]')).toHaveAttribute('data-mark', 'violet');
  await expect(summaryLog.locator('td[data-r="s4"][data-c="name"]')).toHaveAttribute('data-mark', 'red');
  await expect(summaryLog.locator('textarea')).toHaveCount(0);
  await phone.screenshot({ path: 'docs/reports/M4/summary-with-log-phone.png', fullPage: true });
  await closeAll(t);
});

/** The centre of a table cell, for dragging a paint stroke. */
async function centre(page: Page, row: string, col: string) {
  const box = (await page.locator(`[data-testid="log-sheet"] td[data-r="${row}"][data-c="${col}"]`).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('LOG-01 · LOG-04 · LOG-05 · LOG-06: the full log table at the bottom of the page: pinned columns, note rows, and painting colours', async ({ page, browser, users }) => {
  const t = await liveGame(users, browser, 0);
  await page.setViewportSize({ width: 1366, height: 1024 });
  await signIn(page, t.dm);
  await page.goto(`/room/${t.code}`);
  const sheet = page.getByRole('region', { name: '日志总表' });
  const table = page.getByTestId('log-sheet');
  const cell = (row: string, col: string) => table.locator(`td[data-r="${row}"][data-c="${col}"]`);

  // LOG-01: five players, so min(5, ⌊5 / 2⌋) = 2 nights and days.
  await expect(table.locator('thead th')).toHaveText(['座位', '玩家', '初始角色', '角色设置', '第1夜', '第1天', '第2夜', '第2天']);
  await expect(page.getByTestId('log-sheet-seat-3')).toContainText(`${t.players[2]!.nickname}`);
  await expect(page.getByTestId('log-sheet-seat-3')).toContainText('酒鬼');
  // LOG-06: from the start, the evil rows are red and the outsider's row yellow, every column.
  await expect(cell('s4', 'name')).toHaveAttribute('data-mark', 'red');
  await expect(cell('s5', 'd2')).toHaveAttribute('data-mark', 'red');
  await expect(cell('s3', 'setup')).toHaveAttribute('data-mark', 'yellow');
  await expect(cell('s1', 'n1')).not.toHaveAttribute('data-mark', /.*/);

  // LOG-04: below the console, full width.
  const grimoire = (await page.getByTestId('grimoire').boundingBox())!;
  const sheetBox = (await sheet.boundingBox())!;
  expect(sheetBox.y).toBeGreaterThan(grimoire.y + grimoire.height);

  // LOG-06: one drag paints a rectangle (seats 1–2 × 第1夜…第1天).
  await sheet.getByRole('button', { name: '醉酒 / 中毒' }).click();
  await expect(sheet.getByRole('button', { name: '醉酒 / 中毒' })).toHaveAttribute('aria-pressed', 'true');
  const from = await centre(page, 's1', 'n1');
  const to = await centre(page, 's2', 'd1');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  for (const [r, c] of [['s1', 'n1'], ['s1', 'd1'], ['s2', 'n1'], ['s2', 'd1']]) await expect(cell(r!, c!)).toHaveAttribute('data-mark', 'violet');
  await expect(cell('s3', 'n1')).toHaveAttribute('data-mark', 'yellow');
  // 撤销 puts the stroke back.
  await sheet.getByRole('button', { name: '撤销' }).click();
  await expect(cell('s1', 'n1')).not.toHaveAttribute('data-mark', /.*/);
  await expect(cell('s2', 'd1')).not.toHaveAttribute('data-mark', /.*/);
  // 清除 in a red row leaves that one cell clear; 死亡 is grey, painted by hand.
  await sheet.getByRole('button', { name: '清除' }).click();
  const clear = await centre(page, 's4', 'setup');
  await page.mouse.click(clear.x, clear.y);
  await expect(cell('s4', 'setup')).not.toHaveAttribute('data-mark', /.*/);
  await expect(cell('s4', 'n1')).toHaveAttribute('data-mark', 'red');
  await sheet.getByRole('button', { name: '死亡' }).click();
  const dead = await centre(page, 's2', 'name');
  await page.mouse.click(dead.x, dead.y);
  await expect(cell('s2', 'name')).toHaveAttribute('data-mark', 'dead');
  await sheet.getByRole('button', { name: '完成' }).click();
  await expect(sheet.getByRole('button', { name: '完成' })).toHaveCount(0);
  // Deaths are never marked automatically.
  await rpc(t.dmc, 'kill_seat', { p_game: t.gameId, p_seat: 5, p_cause: 'night' });
  await expect(page.getByTestId('circle-seat-5')).toContainText('夜间死亡');
  await expect(cell('s5', 'name')).toHaveAttribute('data-mark', 'red');
  // Back to typing: the cells are text boxes again.
  await sheet.getByLabel('1号 第1夜').fill('得知 2号 或 4号 是厨师');
  await sheet.getByLabel('1号 第1夜').press('Control+Enter');
  await expect(sheet.getByText('✓ 已保存')).toBeVisible();

  // LOG-05: a note row below the divider, labelled, written in, then deleted (it asks first).
  await expect(page.getByTestId('log-sheet-divider')).toBeVisible();
  await sheet.getByRole('button', { name: '+ 添加备注行' }).click();
  const note = page.getByTestId('log-sheet-note');
  await expect(note).toHaveCount(1);
  await note.getByLabel('备注行名称').fill('恶魔伪装');
  await note.getByLabel('备注行名称').press('Tab');
  await expect(note.getByLabel('恶魔伪装 第1夜')).toBeVisible();
  await note.getByLabel('恶魔伪装 第1夜').fill('僧侣 / 圣徒 / 士兵');
  await note.getByLabel('恶魔伪装 第1夜').press('Control+Enter');
  await page.getByRole('tab', { name: '日志' }).click();
  await expect(page.getByRole('region', { name: '说书人日志' }).getByLabel('恶魔伪装 第1夜')).toHaveValue('僧侣 / 圣徒 / 士兵');
  await note.getByRole('button', { name: '删除备注行' }).click();
  await note.getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.getByTestId('log-sheet-note')).toHaveCount(0);

  // LOG-04: the phases scroll sideways inside the table; 座位 / 玩家 / 初始角色 stay put.
  await page.setViewportSize({ width: 390, height: 844 });
  await sheet.scrollIntoViewIfNeeded();
  const scroller = table.locator('xpath=..');
  const before = (await cell('s1', 'role').boundingBox())!;
  await scroller.evaluate((e) => (e.scrollLeft = 600));
  await expect.poll(() => scroller.evaluate((e) => e.scrollLeft)).toBeGreaterThan(0);
  const after = (await cell('s1', 'role').boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThan(1);
  expect((await cell('s1', 'd2').boundingBox())!.x).toBeLessThan((await page.viewportSize())!.width);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await sheet.screenshot({ path: 'docs/reports/M4/log-sheet-phone.png' });
});
