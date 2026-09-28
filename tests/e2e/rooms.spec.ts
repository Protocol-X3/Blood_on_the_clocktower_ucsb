import { mkdirSync } from 'node:fs';
import { clientFor } from '../support/users.ts';
import { expect, otherBrowser, signIn, test } from './support/session.ts';

const SHOTS = 'docs/reports/M1';

test('M1.4 · ROOM-01: a DM-eligible user creates a room from the home page and starts in the DM seat', async ({ page, users }, info) => {
  const dm = await users.make({ level: 'dm_eligible' });
  await signIn(page, dm);
  await page.goto('/');
  await page.getByRole('button', { name: '创建房间' }).click();
  await page.getByRole('button', { name: '增加座位' }).click();
  await page.getByRole('button', { name: '创建', exact: true }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{4}$/);
  await expect(page.getByTestId('room-code')).toHaveText(/^[A-HJKMNP-Z2-9]{4}$/);
  await expect(page.getByTestId('dm-seat')).toContainText(dm.nickname!);
  await expect(page.getByRole('list', { name: '座位' }).getByRole('listitem')).toHaveCount(11);
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/lobby-dm-${info.project.name}.png`, fullPage: true });
});

test('ROOM-01: players and guests are not offered 创建房间', async ({ page, users }) => {
  await signIn(page, await users.make());
  await page.goto('/');
  await expect(page.getByRole('button', { name: '加入房间' })).toBeVisible();
  await expect(page.getByRole('button', { name: '创建房间' })).toHaveCount(0);
});

test('ROOM-03: joining by code ignores letter case; an unknown code shows 房间不存在', async ({ page, users }) => {
  const dm = await users.make({ level: 'dm_eligible' });
  const code = (await (await clientFor(dm)).rpc('create_room', {})).data!;
  await signIn(page, await users.make());
  await page.goto('/');
  await page.getByLabel('输入房间码加入对局').fill(code.toLowerCase());
  await page.getByRole('button', { name: '加入房间' }).click();
  await expect(page.getByTestId('room-code')).toHaveText(code);

  await page.goto('/room/ZZZZ');
  await expect(page.getByRole('heading', { name: '房间不存在' })).toBeVisible();
});

test('ROOM-06 · ROOM-13: a player takes, moves and leaves seats, and the DM sees each change within 3 s', async ({ page, browser, users }, info) => {
  const dm = await users.make({ level: 'dm_eligible' });
  const code = (await (await clientFor(dm)).rpc('create_room', { p_seat_count: 7 })).data!;
  const player = await users.make();
  const dmPage = await otherBrowser(browser, dm);
  await dmPage.goto(`/room/${code}`);
  await signIn(page, player);
  await page.goto(`/room/${code}`);

  await page.getByTestId('seat-2').getByRole('button', { name: '坐下' }).click();
  await expect(dmPage.getByTestId('seat-2')).toContainText(player.nickname!, { timeout: 3000 });
  await page.getByTestId('seat-6').getByRole('button', { name: '坐下' }).click();
  await expect(dmPage.getByTestId('seat-6')).toContainText(player.nickname!, { timeout: 3000 });
  await expect(dmPage.getByTestId('seat-2')).toContainText('空座', { timeout: 3000 });
  mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/lobby-player-${info.project.name}.png`, fullPage: true });
  await page.getByTestId('seat-6').getByRole('button', { name: '离座' }).click();
  await expect(dmPage.getByTestId('seat-6')).toContainText('空座', { timeout: 3000 });
  await dmPage.context().close();
});

test('ROOM-05 · ROOM-12: the DM changes the seat count, but not below an occupied seat', async ({ page, users }) => {
  const dm = await users.make({ level: 'dm_eligible' });
  const code = (await (await clientFor(dm)).rpc('create_room', { p_seat_count: 6 })).data!;
  const player = await users.make();
  const pc = await clientFor(player);
  const roomId = (await pc.rpc('join_room', { p_code: code })).data!;
  await pc.rpc('take_seat', { p_room: roomId, p_seat: 6 });

  await signIn(page, dm);
  await page.goto(`/room/${code}`);
  await page.getByRole('button', { name: '增加座位' }).click();
  await expect(page.getByTestId('seat-count')).toHaveText('7');
  await page.getByRole('button', { name: '减少座位' }).click();
  await expect(page.getByTestId('seat-count')).toHaveText('6');
  await page.getByRole('button', { name: '减少座位' }).click();
  await expect(page.getByRole('alert')).toHaveText('座位数不能少于已占用的最大座位号');
  await expect(page.getByTestId('seat-count')).toHaveText('6');
});

test('ROOM-08 · ROOM-13: the DM moves, unseats and removes a player, who sees it happen', async ({ page, browser, users }) => {
  const dm = await users.make({ level: 'dm_eligible' });
  const code = (await (await clientFor(dm)).rpc('create_room', { p_seat_count: 6 })).data!;
  const player = await users.make();
  await signIn(page, player);
  await page.goto(`/room/${code}`);
  await page.getByTestId('seat-1').getByRole('button', { name: '坐下' }).click();

  const dmPage = await otherBrowser(browser, dm);
  await dmPage.goto(`/room/${code}`);
  await dmPage.getByTestId('seat-1').getByRole('button', { name: '管理' }).click();
  await dmPage.getByLabel('移到座位').selectOption('4');
  await dmPage.getByRole('button', { name: '移动' }).click();
  await expect(page.getByTestId('seat-4')).toContainText(player.nickname!, { timeout: 3000 });

  await dmPage.getByTestId('seat-4').getByRole('button', { name: '管理' }).click();
  await dmPage.getByRole('button', { name: '移出座位' }).click();
  await expect(page.getByRole('list', { name: '旁观者' })).toContainText(player.nickname!, { timeout: 3000 });

  await dmPage.getByRole('list', { name: '旁观者' }).getByRole('button', { name: '管理' }).click();
  await dmPage.getByRole('button', { name: '移出房间' }).click();
  await expect(page.getByRole('heading', { name: '你已离开房间' })).toBeVisible({ timeout: 3000 });
  await dmPage.context().close();
});

test('M1.4 · ROOM-09 · ROOM-10: the DM leaves the DM seat; a DM-eligible member takes it; a player is never offered it', async ({ page, browser, users }) => {
  const dm = await users.make({ level: 'dm_eligible' });
  const code = (await (await clientFor(dm)).rpc('create_room', {})).data!;
  const player = await users.make();
  const other = await users.make({ level: 'dm_eligible' });

  const dmPage = await otherBrowser(browser, dm);
  await dmPage.goto(`/room/${code}`);
  await dmPage.getByRole('button', { name: '离开说书人座位' }).click();
  await expect(dmPage.getByTestId('dm-seat')).toContainText('空缺');

  const playerPage = await otherBrowser(browser, player);
  await playerPage.goto(`/room/${code}`);
  await expect(playerPage.getByTestId('dm-seat')).toContainText('空缺');
  await expect(playerPage.getByRole('button', { name: '担任说书人' })).toHaveCount(0);

  await signIn(page, other);
  await page.goto(`/room/${code}`);
  await page.getByRole('button', { name: '担任说书人' }).click();
  await expect(page.getByTestId('dm-seat')).toContainText(other.nickname!);
  await expect(playerPage.getByTestId('dm-seat')).toContainText(other.nickname!, { timeout: 3000 });
  await dmPage.context().close();
  await playerPage.context().close();
});

test('ROOM-14: the creator closes the room; it can no longer be entered', async ({ page, users }) => {
  const dm = await users.make({ level: 'dm_eligible' });
  const code = (await (await clientFor(dm)).rpc('create_room', {})).data!;
  await signIn(page, dm);
  await page.goto(`/room/${code}`);
  await page.getByRole('button', { name: '关闭房间' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto(`/room/${code}`);
  await expect(page.getByRole('heading', { name: '房间不存在' })).toBeVisible();
});
