import { devices, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { admin, clientFor, type TestUser } from '../support/users.ts';
import { closeAll, liveGame, rpc } from './support/game.ts';
import { expect, otherBrowser, signIn, test } from './support/session.ts';

// DM screens on the tablet profile; players on phone-sized browsers, or through the API.
test.describe.configure({ mode: 'serial' });

test('M3.4 · PHASE-02 · DEATH-01 · DEATH-02 · NOM-04 · VOTE-01 · VOTE-13 · VOTE-14 · BOARD-01 · BOARD-02 · END-02 · END-03 · END-04: a full game, from the lobby to the summary', async ({
  page,
  browser,
  users,
}, info) => {
  test.slow();
  // The lobby: the DM on a tablet, five players on phones who sit down themselves.
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
  const { data: code } = await dmc.rpc('create_room', { p_seat_count: 5 });
  await signIn(page, dm);
  await page.goto(`/room/${code}`);
  const players: TestUser[] = [];
  const phones: Page[] = [];
  for (let seat = 1; seat <= 5; seat += 1) {
    const p = await users.make();
    const phone = await otherBrowser(browser, p, { ...devices['Pixel 7'] });
    await phone.goto(`/room/${code}`);
    await phone.getByTestId(`seat-${seat}`).getByRole('button', { name: '坐下' }).click();
    await expect(phone.getByTestId(`seat-${seat}`)).toContainText(p.nickname!);
    players.push(p);
    phones.push(phone);
  }
  const name = (seat: number) => players[seat - 1]!.nickname!;

  // Setup, by hand: seat 3 gets the Drunk, shown as the Empath.
  await page.getByRole('button', { name: '开始配置对局' }).click();
  await page.getByLabel('剧本').selectOption({ label: script });
  await page.getByRole('radio', { name: /手动分配/ }).check();
  await page.getByRole('button', { name: '下一步' }).click();
  const scriptRoles = page.getByRole('region', { name: '剧本角色' });
  for (const r of ['洗衣妇', '厨师', '酒鬼', '投毒者', '小恶魔']) await scriptRoles.getByRole('button', { name: r, exact: true }).click();
  await page.getByLabel('酒鬼 展示为').selectOption({ label: '共情者' });
  await page.getByRole('button', { name: '下一步' }).click();
  for (const [seat, label] of ['洗衣妇', '厨师', '酒鬼（展示：共情者）', '投毒者', '小恶魔'].entries()) {
    await page.getByLabel(`${seat + 1}号的角色`, { exact: true }).selectOption({ label });
  }
  await page.getByRole('button', { name: '开始游戏' }).click();

  // 第1夜: the Drunk sees the Empath. The DM marks seat 5 dead at night.
  await phones[2]!.getByTestId('role-hidden').click();
  await expect(phones[2]!.getByTestId('role-card')).toContainText('共情者');
  await page.getByTestId('circle-seat-5').getByRole('button').click();
  await page.getByRole('radio', { name: '夜间死亡' }).check();
  await page.getByRole('button', { name: '标记死亡' }).click();
  await expect(phones[0]!.getByTestId('town-seat-5')).toContainText('夜间死亡');

  // 第1天
  await page.getByRole('button', { name: '进入第1天' }).click();
  for (const phone of phones) await expect(phone.getByRole('heading', { name: '第1天' })).toBeVisible();

  // A nomination: 1 → 2. Everyone sees it (NOM-04).
  await page.getByRole('tab', { name: '提名' }).click();
  await page.getByRole('combobox', { name: '提名者', exact: true }).selectOption({ label: `1号 ${name(1)}` });
  await page.getByRole('combobox', { name: '被提名者' }).selectOption({ label: `2号 ${name(2)}` });
  await page.getByRole('button', { name: '发起提名' }).click();
  for (const phone of phones) await expect(phone.getByTestId('nomination-status')).toContainText(`1号 ${name(1)} 提名 2号 ${name(2)}`);

  // Hands: seats 1 and 3, and the dead seat 5 with their ghost vote (VOTE-01, live for everyone).
  for (const seat of [1, 3, 5]) await phones[seat - 1]!.getByRole('button', { name: '举手' }).click();
  for (const seat of [1, 3, 5]) await expect(phones[3]!.getByTestId(`circle-seat-${seat}`)).toHaveAttribute('data-raised', 'true');
  await expect(phones[3]!.getByTestId('circle-seat-2')).toHaveAttribute('data-raised', 'false');

  // The circle, at the fastest speed: 4 living → threshold 2; count 3.
  await page.getByRole('button', { name: '开始计票' }).click();
  await page.getByLabel('指针速度').fill('500');
  await expect(page.getByText('计票完成：')).toBeVisible({ timeout: 15_000 });
  for (const phone of phones) {
    await expect(phone.getByTestId('vote-tally')).toContainText('3');
    await expect(phone.getByTestId('vote-tally')).toContainText('需 2 票');
  }
  await expect(phones[4]!.getByTestId('town-seat-5')).toContainText('票已用');
  await page.getByRole('button', { name: '结束投票' }).click();
  for (const phone of phones) await expect(phone.getByText(`上处决台：2号 ${name(2)}`)).toBeVisible();

  // A board post from a player, seen by all (BOARD-01 / BOARD-02).
  await phones[3]!.getByLabel('发布内容').fill('我是投毒者？开玩笑的');
  await phones[3]!.getByRole('button', { name: '发布' }).click();
  await expect(phones[0]!.getByTestId('board-post').first()).toContainText(`4号 ${name(4)}`);
  await expect(phones[0]!.getByTestId('board-post').first()).toContainText('第1天');
  await page.getByRole('tab', { name: '公告板' }).click();
  await expect(page.getByTestId('board-post').first()).toContainText('我是投毒者？开玩笑的');

  // The execution (VOTE-14), then a revive (DEATH-02).
  await page.getByRole('tab', { name: '提名' }).click();
  await page.getByRole('button', { name: '处决 2号' }).click();
  await expect(phones[0]!.getByTestId('town-seat-2')).toContainText('处决');
  await page.getByTestId('circle-seat-5').getByRole('button').click();
  await page.getByRole('button', { name: '复活' }).click();
  await expect(phones[0]!.getByTestId('town-seat-5')).toContainText('存活');

  if (info.project.name === 'tablet') {
    mkdirSync('docs/reports/M3', { recursive: true });
    await page.screenshot({
      path: 'docs/reports/M3/dm-day-tablet.png',
      fullPage: true,
    });
    await phones[0]!.screenshot({
      path: 'docs/reports/M3/player-day-phone.png',
      fullPage: true,
    });
  }

  // The end: good wins; everyone lands on the summary.
  await page.getByRole('button', { name: '结束游戏' }).click();
  await page.getByRole('button', { name: '善良阵营获胜' }).click();
  for (const p of [page, ...phones]) {
    await expect(p).toHaveURL(new RegExp(`/room/${code}/summary$`));
    await expect(p.getByTestId('winner')).toHaveText('善良阵营获胜');
  }
  // END-03: actual and shown roles, alignment, deaths with causes.
  await expect(phones[0]!.getByTestId('summary-seat-3')).toContainText('酒鬼');
  await expect(phones[0]!.getByTestId('summary-seat-3')).toContainText('展示：共情者');
  await expect(phones[0]!.getByTestId('summary-seat-2')).toContainText('第1天 处决');
  await expect(phones[0]!.getByTestId('summary-seat-5')).toContainText('第1夜 夜间死亡 · 已复活');
  await expect(phones[0]!.getByTestId('summary-seat-5')).toContainText('邪恶');
  await phones[0]!.screenshot({
    path: 'docs/reports/M3/summary-phone.png',
    fullPage: true,
  });

  // END-04: back to the lobby, seats kept.
  await phones[0]!.getByRole('link', { name: '返回房间' }).click();
  await expect(phones[0]!.getByTestId('seat-1')).toContainText(name(1));
  await expect(phones[0]!.getByTestId('seat-5')).toContainText(name(5));
  for (const phone of phones) await phone.context().close();
});

test('M3.5 · PHASE-03: player screens use the night theme at night and the day theme by day', async ({ browser, users }) => {
  const t = await liveGame(users, browser);
  const theme = t.phones[0]!.getByTestId('game-theme');
  await expect(theme).toHaveAttribute('data-theme', 'night');
  await rpc(t.dmc, 'advance_phase', { p_game: t.gameId });
  await expect(theme).toHaveAttribute('data-theme', 'day');
  await rpc(t.dmc, 'advance_phase', { p_game: t.gameId });
  await expect(theme).toHaveAttribute('data-theme', 'night');
  await closeAll(t);
});

test('M3.7 · RECON-01: a player who reloads mid-vote sees the same state', async ({ browser, users }) => {
  const t = await liveGame(users, browser);
  const phone = t.phones[0]!;
  await rpc(t.dmc, 'advance_phase', { p_game: t.gameId });
  const { data: nom } = await t.dmc.rpc('open_nomination', {
    p_game: t.gameId,
    p_nominator: 2,
    p_nominee: 3,
  });
  await phone.getByRole('button', { name: '举手' }).click();
  await rpc(t.clients[3]!, 'set_hand', { p_nomination: nom!, p_raised: true });
  await rpc(t.dmc, 'start_vote', { p_nomination: nom! });
  for (let i = 0; i < 2; i += 1) await rpc(t.dmc, 'advance_vote', { p_nomination: nom!, p_expected: i });
  // The hand has passed seats 4 (raised) and 5; seat 1 (this phone, raised) is next.
  const snapshot = async () => ({
    phase: await phone.getByRole('heading', { level: 1 }).textContent(),
    nomination: await phone.getByTestId('nomination-status').textContent(),
    tally: await phone.getByTestId('vote-tally').textContent(),
    seats: await Promise.all([1, 2, 3, 4, 5].map((s) => phone.getByTestId(`circle-seat-${s}`).getAttribute('data-vote'))),
    hand: await phone.getByRole('button', { name: /举手/ }).textContent(),
  });
  await expect(phone.getByTestId('circle-seat-1')).toHaveAttribute('data-vote', 'current');
  const before = await snapshot();
  await phone.reload();
  await expect(phone.getByTestId('circle-seat-1')).toHaveAttribute('data-vote', 'current');
  expect(await snapshot()).toEqual(before);
  expect(before.seats).toEqual(['current', 'none', 'nominee', 'locked-yes', 'locked-no']);
  expect(before.hand).toContain('已举手');
  await expect(phone.getByTestId('role-card').or(phone.getByRole('button', { name: /我的角色/ }))).toBeVisible();
  await closeAll(t);
});

test('VOTE-05 · VOTE-06 · VOTE-12: the clock ticks on the DM’s screen; pausing, stepping, and a DM who drops offline all leave the hand where it is', async ({
  page,
  browser,
  users,
}) => {
  // Deliberate waits (a paused hand, an offline DM) plus 3 s ticks: more than the default 30 s.
  test.slow();
  const t = await liveGame(users, browser);
  const phone = t.phones[0]!;
  await rpc(t.dmc, 'advance_phase', { p_game: t.gameId });
  const { data: nom } = await t.dmc.rpc('open_nomination', {
    p_game: t.gameId,
    p_nominator: 1,
    p_nominee: 5,
  });
  await signIn(page, t.dm);
  await page.goto(`/room/${t.code}`);
  await expect(page.getByRole('button', { name: '开始计票' })).toBeVisible();
  // VOTE-05: 1.5 s per seat by default.
  await expect(page.getByLabel('指针速度')).toHaveValue('1500');
  await page.getByLabel('指针速度').fill('3000');
  await page.getByRole('button', { name: '开始计票' }).click();
  // The circle for nominee 5 starts at seat 1.
  await expect(phone.getByTestId('circle-seat-1')).toHaveAttribute('data-vote', 'current');
  await expect(phone.getByTestId('circle-seat-2')).toHaveAttribute('data-vote', 'current', { timeout: 6000 });

  // VOTE-06: pause; the hand stays; 下一位 steps exactly one seat.
  await page.getByRole('button', { name: '暂停' }).click();
  const hand = async () => (await t.dmc.from('nominations').select('hand_index').eq('id', nom!).single()).data!.hand_index;
  const paused = await hand();
  await page.waitForTimeout(4000);
  expect(await hand()).toBe(paused);
  await page.getByRole('button', { name: '下一位' }).click();
  await expect.poll(hand).toBe(paused + 1);
  await page.getByRole('button', { name: '继续' }).click();

  // VOTE-12: the DM's device goes offline: the circle waits at the same seat, then carries on.
  await page.getByLabel('指针速度').fill('500');
  await page.context().setOffline(true);
  const stuck = await hand();
  await page.waitForTimeout(2500);
  expect(await hand()).toBe(stuck);
  await page.context().setOffline(false);
  await expect.poll(hand, { timeout: 20_000 }).toBe(5);
  await expect(phone.getByTestId('nomination-status')).toContainText('计票完成');
  await closeAll(t);
});

test('NOM-02: the DM is warned, not stopped, about rule breaks', async ({ page, browser, users }) => {
  const t = await liveGame(users, browser, 0);
  await rpc(t.dmc, 'advance_phase', { p_game: t.gameId });
  await rpc(t.dmc, 'kill_seat', {
    p_game: t.gameId,
    p_seat: 4,
    p_cause: 'night',
  });
  // Today so far: 1 nominated 2, and the vote was held.
  const { data: first } = await t.dmc.rpc('open_nomination', {
    p_game: t.gameId,
    p_nominator: 1,
    p_nominee: 2,
  });
  await rpc(t.dmc, 'start_vote', { p_nomination: first! });
  for (let i = 0; i < 5; i += 1) await rpc(t.dmc, 'advance_vote', { p_nomination: first!, p_expected: i });
  await rpc(t.dmc, 'close_vote', { p_nomination: first! });
  await signIn(page, t.dm);
  await page.goto(`/room/${t.code}`);
  await page.getByRole('tab', { name: '提名' }).click();
  const warnings = page.getByRole('status').filter({ hasText: '仍可提名' });
  await page.getByRole('combobox', { name: '提名者', exact: true }).selectOption({ index: 0 });
  await page.getByRole('combobox', { name: '被提名者' }).selectOption({ index: 2 });
  await expect(warnings).toContainText('提名者今天已经提名过');
  await page.getByRole('combobox', { name: '提名者', exact: true }).selectOption({ index: 2 });
  await page.getByRole('combobox', { name: '被提名者' }).selectOption({ index: 1 });
  await expect(warnings).toContainText('被提名者今天已经被提名过');
  await page.getByRole('combobox', { name: '提名者', exact: true }).selectOption({ index: 3 });
  await page.getByRole('combobox', { name: '被提名者' }).selectOption({ index: 4 });
  await expect(warnings).toContainText('提名者已死亡');
  await page.getByRole('button', { name: '发起提名' }).click();
  await expect(page.getByRole('region', { name: '当前提名' })).toContainText('4号');
});

test('DEATH-03 · VOTE-02 · VOTE-04: the dead are greyed with 亡 everywhere; a spent ghost vote and a locked vote leave no hand to raise', async ({
  page,
  browser,
  users,
}) => {
  const t = await liveGame(users, browser, 2);
  const [p1, p2] = t.phones as [Page, Page];
  await rpc(t.dmc, 'kill_seat', {
    p_game: t.gameId,
    p_seat: 2,
    p_cause: 'night',
  });
  await rpc(t.dmc, 'set_ghost_vote', {
    p_game: t.gameId,
    p_seat: 2,
    p_used: true,
  });
  await rpc(t.dmc, 'advance_phase', { p_game: t.gameId });
  await signIn(page, t.dm);
  await page.goto(`/room/${t.code}`);
  for (const p of [page, p1]) {
    await expect(p.getByTestId('circle-seat-2')).toHaveAttribute('data-alive', 'false');
    await expect(p.getByTestId('circle-seat-2').getByText('亡', { exact: true })).toBeVisible();
    await expect(p.getByTestId('circle-seat-2').getByTestId('dead-mark')).toBeVisible();
    await expect(p.getByTestId('circle-seat-1').getByTestId('dead-mark')).toHaveCount(0);
    await expect(p.getByTestId('circle-seat-2').locator(':scope > :first-child')).toHaveClass(/grayscale/);
  }
  const { data: nom } = await t.dmc.rpc('open_nomination', {
    p_game: t.gameId,
    p_nominator: 3,
    p_nominee: 5,
  });
  await expect(p2.getByText('你的幽灵票已用完，不能举手')).toBeVisible();
  await expect(p2.getByRole('button', { name: '举手' })).toHaveCount(0);
  await rpc(t.dmc, 'start_vote', { p_nomination: nom! });
  await rpc(t.dmc, 'advance_vote', { p_nomination: nom!, p_expected: 0 });
  await expect(p1.getByText('你的票已锁定：未举手')).toBeVisible();
  await expect(p1.getByRole('button', { name: '举手' })).toHaveCount(0);
  await closeAll(t);
});
