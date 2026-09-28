import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { clientFor, type TestUser } from '../support/users.ts';
import { expect, signIn, test } from './support/session.ts';

// Player-facing pages available so far. Later milestones add to this list.
interface Ctx {
  code: string;
  scriptId: string;
  me: string;
  gameId: string;
}
// game: the signed-in user sits in seat 1 of a running game at night, mid-vote by day, or after it ended.
type GameState = 'night' | 'vote' | 'ended';
const PAGES: { name: string; signedIn: boolean; game?: GameState; path: (ctx: Ctx) => string }[] = [
  { name: 'login', signedIn: false, path: () => '/login' },
  { name: 'not found', signedIn: false, path: () => '/no-such-page' },
  { name: 'home', signedIn: true, path: () => '/' },
  { name: 'room lobby', signedIn: true, path: (c) => `/room/${c.code}` },
  { name: 'script library', signedIn: true, path: () => '/scripts' },
  { name: 'script detail', signedIn: true, path: (c) => `/scripts/${c.scriptId}` },
  { name: 'live game, night', signedIn: true, game: 'night', path: (c) => `/room/${c.code}` },
  { name: 'live game, day vote', signedIn: true, game: 'vote', path: (c) => `/room/${c.code}` },
  { name: 'game summary', signedIn: true, game: 'ended', path: (c) => `/room/${c.code}/summary` },
  { name: 'profile', signedIn: true, game: 'ended', path: (c) => `/profile/${c.me}` },
  { name: 'game history', signedIn: true, game: 'ended', path: (c) => `/games/${c.gameId}` },
];

/** Seats the players in the room, starts a game through the API and brings it to the given state. */
async function runningGame(dmc: Awaited<ReturnType<typeof clientFor>>, ctx: Ctx, players: TestUser[], state: GameState) {
  const roomId = (await dmc.rpc('join_room', { p_code: ctx.code })).data!;
  await dmc.rpc('set_seat_count', { p_room: roomId, p_count: 5 });
  for (const [i, u] of players.entries()) {
    const c = await clientFor(u);
    await c.rpc('join_room', { p_code: ctx.code });
    await c.rpc('take_seat', { p_room: roomId, p_seat: i + 1 });
  }
  const game = (await dmc.rpc('start_setup', { p_room: roomId, p_script: ctx.scriptId, p_mode: 'manual' })).data!;
  ctx.gameId = game;
  const roles = ['washerwoman', 'fortuneteller', 'drunk', 'poisoner', 'imp'];
  await dmc.rpc('set_composition', { p_game: game, p_roles: roles.map((role) => ({ role })) });
  for (const [i, role] of roles.entries()) await dmc.rpc('assign_seat', { p_game: game, p_seat: i + 1, p_role: role });
  expect((await dmc.rpc('start_game', { p_game: game })).error).toBeNull();
  await dmc.rpc('kill_seat', { p_game: game, p_seat: 3, p_cause: 'night' });
  if (state === 'night') return;
  await dmc.rpc('advance_phase', { p_game: game });
  await dmc.rpc('post_board', { p_game: game, p_body: '天亮了，请大家发言。' });
  const nom = (await dmc.rpc('open_nomination', { p_game: game, p_nominator: 2, p_nominee: 4 })).data!;
  await dmc.rpc('start_vote', { p_nomination: nom });
  await dmc.rpc('advance_vote', { p_nomination: nom, p_expected: 0 });
  if (state === 'vote') return;
  expect((await dmc.rpc('end_game', { p_game: game, p_winner: 'good' })).error).toBeNull();
}

async function open(page: Page, p: (typeof PAGES)[number], make: () => Promise<TestUser>, makeDm: () => Promise<TestUser>) {
  const ctx: Ctx = { code: '', scriptId: '', me: '', gameId: '' };
  if (p.signedIn) {
    const dmc = await clientFor(await makeDm());
    ctx.code = (await dmc.rpc('create_room', { p_seat_count: 10 })).data!;
    ctx.scriptId = (await dmc.rpc('save_script', {
      p_script: null as unknown as string,
      p_name: '界面测试剧本',
      p_author: '',
      p_roles: ['washerwoman', 'fortuneteller', 'drunk', 'poisoner', 'imp'],
    })).data!;
    const me = await make();
    ctx.me = me.id;
    if (p.game) await runningGame(dmc, ctx, [me, ...(await Promise.all([1, 2, 3, 4].map(() => make())))], p.game);
    await signIn(page, me);
  }
  await page.goto(p.path(ctx));
  await expect(page.locator('#root h1')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const p of PAGES) {
  test.describe(`player page: ${p.name}`, () => {
    test('UI-01: no horizontal scroll', async ({ page, users }) => {
      await open(page, p, () => users.make(), () => users.make({ level: 'dm_eligible' }));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('UI-02: buttons, links and inputs are at least 44px tall', async ({ page, users }) => {
      await open(page, p, () => users.make(), () => users.make({ level: 'dm_eligible' }));
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea')]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({ text: el.textContent?.trim() || el.id, h: el.getBoundingClientRect().height }))
          .filter((t) => t.h < 44),
      );
      expect(small).toEqual([]);
    });

    test('UI-03: Chinese page language and title', async ({ page, users }) => {
      await open(page, p, () => users.make(), () => users.make({ level: 'dm_eligible' }));
      await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
      await expect(page).toHaveTitle(/[一-鿿]/);
      await expect(page.locator('#root h1').first()).toHaveText(/[一-鿿]|^[A-Z0-9]{4}$/);
    });

    test('UI-05: text meets WCAG AA contrast', async ({ page, users }) => {
      await open(page, p, () => users.make(), () => users.make({ level: 'dm_eligible' }));
      const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(results.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}: ${n.failureSummary}`))).toEqual([]);
    });
  });
}

test('UI-05: every theme in the design gallery meets WCAG AA contrast', async ({ page }) => {
  await page.goto('/dev/design');
  await page.evaluate(() => document.fonts.ready);
  const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  expect(results.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}: ${n.failureSummary}`))).toEqual([]);
});

test('UI-06: decorative animation stops when the device asks for reduced motion', async ({ page }) => {
  await page.goto('/login');
  const star = page.locator('[data-twinkle]').first();
  expect(await star.evaluate((el) => getComputedStyle(el).animationName)).toBe('twinkle');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  expect(await page.locator('[data-twinkle]').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});

test('UI-07: an unknown address shows a Chinese not-found page with a way home', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
  await page.getByRole('link', { name: '返回首页' }).click();
  await expect(page.getByRole('heading', { name: '血染钟楼' })).toBeVisible();
});
