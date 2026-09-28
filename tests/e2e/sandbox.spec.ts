import { mkdirSync } from 'node:fs';
import { admin, clientFor } from '../support/users.ts';
import { expect, signIn, test } from './support/session.ts';

// The E2E build is a sandbox build (`vite build --mode sandbox`); production is checked by
// the @prod smoke test below, which only runs against the deployed site.

const TEN = ['洗衣妇', '图书管理员', '调查员', '厨师', '共情者', '占卜师', '送葬者', '投毒者', '间谍', '小恶魔'];

test('M3.6 · BOT-02: the DM fills nine seats with bots; they draw cards, and a vote circle completes with their votes', async ({
  page,
  users,
}, info) => {
  test.slow();
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
  const { data: code } = await dmc.rpc('create_room', { p_seat_count: 10 });
  const roomId = (await dmc.rpc('join_room', { p_code: code! })).data!;
  const human = await users.make();
  const hc = await clientFor(human);
  await hc.rpc('join_room', { p_code: code! });
  await hc.rpc('take_seat', { p_room: roomId, p_seat: 1 });

  await signIn(page, dm);
  await page.goto(`/room/${code}`);
  const sandbox = page.getByRole('region', { name: '机器人沙盒' });
  await sandbox.getByRole('button', { name: '填充机器人' }).click();
  await expect(sandbox.getByRole('status')).toHaveText('已加入 9 个机器人');
  for (let seat = 2; seat <= 10; seat += 1) await expect(page.getByTestId(`seat-${seat}`)).toContainText(`机器人${seat}`);

  // Card draw: the bots draw by themselves; the human draws through the API.
  await page.getByRole('button', { name: '开始配置对局' }).click();
  await page.getByLabel('剧本').selectOption({ label: script });
  await page.getByRole('radio', { name: /抽卡/ }).check();
  await page.getByRole('button', { name: '下一步' }).click();
  const scriptRoles = page.getByRole('region', { name: '剧本角色' });
  for (const r of TEN) await scriptRoles.getByRole('button', { name: r, exact: true }).click();
  await page.getByRole('button', { name: '下一步' }).click();
  await page.getByRole('button', { name: '发牌' }).click();
  const gameId = (await dmc.from('games').select('id').eq('room_id', roomId).neq('status', 'ended').single()).data!.id;
  await expect
    .poll(async () => (await admin.from('draw_slots').select('card_no').eq('game_id', gameId).not('taken_by_seat', 'is', null)).data!.length, {
      timeout: 20_000,
    })
    .toBe(9);
  const free = (await admin.from('draw_slots').select('card_no').eq('game_id', gameId).is('taken_by_seat', null)).data![0]!.card_no;
  expect((await hc.rpc('draw_card', { p_game: gameId, p_card: free })).error).toBeNull();
  await page.getByRole('button', { name: '开始游戏' }).click();

  // Day 1: a nomination; the bots raise hands at random, and the circle runs through them.
  await page.getByRole('button', { name: '进入第1天' }).click();
  await page.getByRole('tab', { name: '提名' }).click();
  await page.getByRole('combobox', { name: '提名者', exact: true }).selectOption({ index: 0 });
  await page.getByRole('combobox', { name: '被提名者' }).selectOption({ index: 1 });
  await page.getByRole('button', { name: '发起提名' }).click();
  await expect(page.getByRole('region', { name: '当前提名' })).toBeVisible();
  const nom = async () => (await admin.from('nominations').select('id, status, vote_count').eq('game_id', gameId).single()).data!;
  const botHands = async () =>
    (
      await admin
        .from('votes')
        .select('seat')
        .eq('nomination_id', (await nom()).id)
        .eq('raised', true)
        .gte('seat', 2)
    ).data!.length;
  await expect.poll(botHands, { timeout: 15_000 }).toBeGreaterThan(0);
  await page.getByLabel('指针速度').fill('500');
  await page.getByRole('button', { name: '开始计票' }).click();
  await expect(page.getByText('计票完成：')).toBeVisible({ timeout: 20_000 });
  const { data: votes } = await admin
    .from('votes')
    .select('seat, raised, locked')
    .eq('nomination_id', (await nom()).id);
  expect(votes!.every((v) => v.locked)).toBe(true);
  const botVotes = votes!.filter((v) => v.seat >= 2 && v.raised).length;
  expect(botVotes).toBeGreaterThan(0);
  expect((await nom()).vote_count).toBe(votes!.filter((v) => v.raised).length);
  if (info.project.name === 'tablet') {
    mkdirSync('docs/reports/M3', { recursive: true });
    await page.screenshot({
      path: 'docs/reports/M3/sandbox-vote-tablet.png',
      fullPage: true,
    });
  }
});

test('@smoke @prod BOT-01: the production site has no bot sandbox', async ({ page, users }) => {
  const dm = await users.make({ level: 'dm_eligible' });
  const { data: code } = await (await clientFor(dm)).rpc('create_room', { p_seat_count: 5 });
  await signIn(page, dm);
  await page.goto(`/room/${code}`);
  await expect(page.getByRole('region', { name: '说书人工具' })).toBeVisible();
  await expect(page.getByRole('region', { name: '机器人沙盒' })).toHaveCount(0);
});
