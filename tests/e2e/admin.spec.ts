import { mkdirSync } from 'node:fs';
import { expect, otherBrowser, signIn, test } from './support/session.ts';

// Only one admin can exist: these run in sequence, on the tablet profile only (see playwright.config.ts).
test.describe.configure({ mode: 'serial' });

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
