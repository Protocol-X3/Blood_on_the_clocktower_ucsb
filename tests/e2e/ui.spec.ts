import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { clientFor, type TestUser } from '../support/users.ts';
import { expect, signIn, test } from './support/session.ts';

// Player-facing pages available so far. Later milestones add to this list.
const PAGES: { name: string; signedIn: boolean; path: (code: string) => string }[] = [
  { name: 'login', signedIn: false, path: () => '/login' },
  { name: 'not found', signedIn: false, path: () => '/no-such-page' },
  { name: 'home', signedIn: true, path: () => '/' },
  { name: 'room lobby', signedIn: true, path: (code) => `/room/${code}` },
];

async function open(page: Page, p: (typeof PAGES)[number], make: () => Promise<TestUser>, makeDm: () => Promise<TestUser>) {
  let code = '';
  if (p.signedIn) {
    const dm = await makeDm();
    code = (await (await clientFor(dm)).rpc('create_room', { p_seat_count: 10 })).data!;
    await signIn(page, await make());
  }
  await page.goto(p.path(code));
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
