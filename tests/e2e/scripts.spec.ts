import { mkdirSync } from 'node:fs';
import { expect, signIn, test } from './support/session.ts';

test('M2.3 · SCRIPT-01 · SCRIPT-03 · SCRIPT-04 · SCRIPT-05: a DM builds a script from library roles plus a custom role, saves it and reopens it', async ({ page, users }, info) => {
  await signIn(page, await users.make({ level: 'dm_eligible' }));
  await page.goto('/scripts');
  await page.getByRole('link', { name: '新建剧本' }).click();
  const name = `测试剧本${Date.now() % 100000}`;
  await page.getByLabel('剧本名称').fill(name);

  const library = page.getByRole('region', { name: '角色库' });
  for (const role of ['洗衣妇', '投毒者', '小恶魔']) await library.getByRole('button', { name: role, exact: true }).click();

  await page.getByRole('button', { name: '新建自定义角色' }).click();
  const dialog = page.getByRole('dialog', { name: '新建自定义角色' });
  const custom = `月光骑士${Date.now() % 1000}`;
  await dialog.getByLabel('角色名称').fill(custom);
  await dialog.getByLabel('阵营').selectOption('townsfolk');
  await dialog.getByLabel('能力').fill('每个夜晚，你会得知一名玩家是否醒来过。');
  await dialog.getByRole('button', { name: '创建角色' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('region', { name: '已选角色' })).toContainText(custom);

  await page.getByRole('button', { name: '保存剧本' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  // SCRIPT-05: grouped by team, in order.
  const sections = page.getByRole('region').filter({ has: page.getByRole('heading', { level: 2 }) });
  await expect(sections.nth(0)).toContainText('镇民 · 2');
  await expect(sections.nth(1)).toContainText('爪牙 · 1');
  await expect(sections.nth(2)).toContainText('恶魔 · 1');
  await expect(page.getByRole('region', { name: '镇民' })).toContainText(custom);
  mkdirSync('docs/reports/M2', { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `docs/reports/M2/script-${info.project.name}.png`, fullPage: true });

  // Reopen for editing: the selection is kept.
  await page.getByRole('link', { name: '编辑剧本' }).click();
  await expect(page.getByRole('region', { name: '已选角色' })).toContainText('已选角色 · 4');
});

test('SCRIPT-01: players browse scripts but cannot create or edit them', async ({ page, users }) => {
  await signIn(page, await users.make());
  await page.goto('/scripts');
  await expect(page.getByRole('heading', { name: '剧本库' })).toBeVisible();
  await expect(page.getByRole('link', { name: '新建剧本' })).toHaveCount(0);
  await page.goto('/scripts/new');
  await expect(page.getByRole('heading', { name: '没有权限' })).toBeVisible();
});

test('SCRIPT-02: a script needs a name and at least one role', async ({ page, users }) => {
  await signIn(page, await users.make({ level: 'dm_eligible' }));
  await page.goto('/scripts/new');
  await page.getByRole('button', { name: '保存剧本' }).click();
  await expect(page.getByRole('alert')).toHaveText('剧本名称需为 1–30 个字，作者最多 30 字');
  await page.getByLabel('剧本名称').fill('空剧本');
  await page.getByRole('button', { name: '保存剧本' }).click();
  await expect(page.getByRole('alert')).toHaveText('剧本至少需要一个角色');
});
