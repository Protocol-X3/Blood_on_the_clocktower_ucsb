import { mkdirSync } from 'node:fs';
import { clearHistory, knownHistory, seedGame } from '../support/fixture.ts';
import { admin, type TestUser } from '../support/users.ts';
import { expect, otherBrowser, signIn, test } from './support/session.ts';

/** Player P's known history (tests/support/fixture.ts), and who else played. */
async function seeded(users: { make: (o?: object) => Promise<TestUser> }) {
  const [p, dm, a, b, c, d] = [await users.make(), await users.make({ level: 'dm_eligible' }), await users.make(), await users.make(), await users.make(), await users.make()];
  for (const u of [p, dm, a, b, c, d]) await clearHistory(u.id);
  const { data: script } = await admin.from('scripts').insert({ name: '暗流涌动', created_by: dm.id }).select('id').single();
  const games: string[] = [];
  for (const g of knownHistory(p.id, [a.id, b.id, c.id, d.id], dm.id, script!.id)) games.push(await seedGame(g));
  return { p, dm, a, games };
}

test('M5.4 · HIST-05 · HIST-01 · STATS-01 · STATS-02 · STATS-03 · STATS-04 · STATS-05: the profile shows the exact numbers and history for a known set of games', async ({ page, users }, info) => {
  const { p } = await seeded(users);
  await signIn(page, p);
  await page.goto('/');
  await page.getByRole('button', { name: /^账号：/ }).click();
  await page.getByRole('link', { name: '个人主页' }).click();
  await expect(page).toHaveURL(new RegExp(`/profile/${p.id}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.nickname!);

  await expect(page.getByTestId('stat-games')).toContainText('5');
  await expect(page.getByTestId('stat-rate')).toContainText('60%');
  await expect(page.getByTestId('stat-good')).toContainText('50%');
  await expect(page.getByTestId('stat-good')).toContainText('1/2');
  await expect(page.getByTestId('stat-evil')).toContainText('67%');
  await expect(page.getByTestId('stat-evil')).toContainText('2/3');
  await expect(page.getByTestId('stat-dm')).toContainText('1');
  const top = page.getByTestId('top-roles').getByRole('listitem');
  await expect(top).toHaveCount(3);
  await expect(top.nth(0)).toContainText('小恶魔');
  await expect(top.nth(0)).toContainText('2 局');
  await expect(top.nth(1)).toContainText('厨师');
  await expect(top.nth(1)).toContainText('2 局');
  await expect(top.nth(2)).toContainText('僧侣');

  // HIST-01: newest first, with date, script, role, alignment and result.
  const rows = page.getByTestId('history-row');
  await expect(rows).toHaveCount(6);
  const expected = [
    ['2026-09-06', '小恶魔 · 邪恶', '胜'],
    ['2026-09-05', '说书人', '说书人'],
    ['2026-09-04', '僧侣 · 善良', '负'],
    ['2026-09-03', '厨师 · 邪恶', '胜'],
    ['2026-09-02', '小恶魔 · 邪恶', '负'],
    ['2026-09-01', '厨师 · 善良', '胜'],
  ];
  for (const [i, [date, role, result]] of expected.entries()) {
    await expect(rows.nth(i)).toContainText(date!);
    await expect(rows.nth(i)).toContainText('暗流涌动');
    await expect(rows.nth(i)).toContainText(role!);
    await expect(rows.nth(i)).toContainText(result!);
  }
  mkdirSync('docs/reports/M5', { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `docs/reports/M5/profile-${info.project.name}.png`, fullPage: true });
});

test('HIST-03 · HIST-02: a past game shows the summary, the nominations with their counts and the board; only its participants may open it', async ({ page, browser, users }, info) => {
  const { p, games } = await seeded(users);
  await signIn(page, p);
  await page.goto(`/profile/${p.id}`);
  await page.getByTestId('history-row').filter({ hasText: '2026-09-02' }).click();
  await expect(page).toHaveURL(new RegExp(`/games/${games[1]}$`));
  await expect(page.getByTestId('winner')).toHaveText('善良阵营获胜');
  await expect(page.getByTestId('summary-seat-1')).toContainText(p.nickname!);
  await expect(page.getByTestId('summary-seat-1')).toContainText('小恶魔');
  await expect(page.getByTestId('summary-seat-4')).toContainText('投毒者');
  const nomination = page.getByTestId('history-nomination');
  await expect(nomination).toContainText(`2号`);
  await expect(nomination).toContainText(`1号 ${p.nickname}`);
  await expect(nomination).toContainText('3 票 / 需 3');
  await expect(nomination).toContainText('处决');
  await expect(page.getByTestId('history-post')).toHaveCount(2);
  // (Seeded together, so both have the same time.)
  await expect(page.getByTestId('history-post').filter({ hasText: '天亮了' })).toContainText('说书人');
  await expect(page.getByTestId('history-post').filter({ hasText: '我觉得 1号 是恶魔' })).toContainText('2号');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `docs/reports/M5/game-history-${info.project.name}.png`, fullPage: true });

  // HIST-02: someone who wasn't in it.
  const stranger = await users.make();
  const strangerPage = await otherBrowser(browser, stranger, { viewport: page.viewportSize() });
  await strangerPage.goto(`/games/${games[1]}`);
  await expect(strangerPage.getByRole('heading', { name: '无法查看' })).toBeVisible();
  await strangerPage.context().close();
});

test('HIST-04: anyone signed in sees a profile’s nickname and stats, but not its games', async ({ page, users }) => {
  const { p } = await seeded(users);
  const viewer = await users.make();
  await clearHistory(viewer.id);
  await signIn(page, viewer);
  await page.goto(`/profile/${p.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.nickname!);
  await expect(page.getByTestId('stat-games')).toContainText('5');
  await expect(page.getByTestId('stat-rate')).toContainText('60%');
  await expect(page.getByTestId('history-row')).toHaveCount(0);
  await expect(page.getByText('暂无可查看的对局')).toBeVisible();
});

test('STATS-06: a guest’s profile has no stats', async ({ page, users }) => {
  const guest = await users.make({ guest: true });
  await clearHistory(guest.id);
  await signIn(page, guest);
  await page.goto(`/profile/${guest.id}`);
  await expect(page.getByRole('status')).toContainText('游客不计入战绩');
  await expect(page.getByTestId('stat-games')).toHaveCount(0);
});
