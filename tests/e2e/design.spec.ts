import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = 'docs/reports/M0';

test('UI-04 · M0.2: every design-system component renders in all three themes', async ({ page }, info) => {
  await page.goto('/dev/design');
  await page.evaluate(() => document.fonts.ready);

  for (const theme of ['day', 'night', 'grimoire']) {
    const scope = page.getByTestId(`theme-${theme}`);
    await expect(scope).toHaveAttribute('data-theme', theme);
    // Role tokens for all four teams, plus dead and selected variants.
    await expect(scope.getByRole('img')).toHaveCount(7);
    await expect(scope.getByRole('img', { name: '送葬者（已死亡）' })).toBeVisible();
    // Team chips, buttons (one disabled) and the gilded role card.
    for (const label of ['镇民', '外来者', '爪牙', '恶魔']) await expect(scope.getByText(label, { exact: true })).toBeVisible();
    await expect(scope.getByRole('button', { name: '举手' })).toBeEnabled();
    await expect(scope.getByRole('button', { name: '已锁定' })).toBeDisabled();
    await expect(scope.getByRole('heading', { name: '共情者' })).toBeVisible();
  }

  // Each theme really differs: its background colour comes from its own tokens.
  const backgrounds = await Promise.all(
    ['day', 'night', 'grimoire'].map((t) => page.getByTestId(`theme-${t}`).evaluate((el) => getComputedStyle(el).backgroundColor)),
  );
  expect(new Set(backgrounds).size).toBe(3);

  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/design-gallery-${info.project.name}.png`, fullPage: true });
});

test('M0.2: sign-in page screenshot', async ({ page }, info) => {
  await page.goto('/login');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('heading', { name: '血染钟楼' })).toBeVisible();
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/login-${info.project.name}.png` });
});
