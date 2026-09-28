import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Player-facing pages available so far. Later milestones add to this list.
const PLAYER_PAGES = ['/', '/login', '/room/K7QX', '/no-such-page'];

for (const path of PLAYER_PAGES) {
  test.describe(`player page ${path}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
    });

    test('UI-01: no horizontal scroll', async ({ page }) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test('UI-02: buttons, links and inputs are at least 44px tall', async ({ page }) => {
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea')]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({ text: el.textContent?.trim() || el.id, h: el.getBoundingClientRect().height }))
          .filter((t) => t.h < 44),
      );
      expect(small).toEqual([]);
    });

    test('UI-03: Chinese page language and title', async ({ page }) => {
      await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
      await expect(page).toHaveTitle(/[一-鿿]/);
      await expect(page.locator('h1')).toHaveText(/[一-鿿]/);
    });

    test('UI-05: text meets WCAG AA contrast', async ({ page }) => {
      const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      expect(results.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
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
  await page.goto('/');
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
  await expect(page).toHaveURL(/\/$/);
});

test('home: joining with a room code opens that room', async ({ page }) => {
  await page.goto('/');
  const join = page.getByRole('button', { name: '加入房间' });
  await expect(join).toBeDisabled();
  await page.getByLabel('输入房间码加入对局').fill('k7qx');
  await expect(join).toBeEnabled();
  await join.click();
  await expect(page).toHaveURL(/\/room\/K7QX$/);
});
