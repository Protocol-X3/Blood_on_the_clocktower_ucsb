// BOT-02: the bot sandbox, for development builds only (BOT-01). This module is only
// ever loaded through `sandbox.ts`, so production builds don't contain it.
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { useGameData } from '@/features/game/useGameData';
import { openNomination } from '@/features/live/model';
import { errorMessage } from '@/services/errors';
import { supabase, type Game, type Room } from '@/services/supabase';

const LINES = ['我是好人，相信我。', '昨晚我什么都没看到。', '我怀疑 3号。', '今天先别处决。', '我有信息，晚点说。', '投他！', '我跟票。'];

/** Lobby tools: fill every empty seat with a bot, or send the bots away. */
export function LobbyBots({ room }: { room: Room }) {
  const [notice, setNotice] = useState<string | null>(null);
  async function run(fn: 'dev_add_bots' | 'dev_remove_bots') {
    const { data, error } = await supabase.rpc(fn, { p_room: room.id });
    setNotice(error ? errorMessage(error) : fn === 'dev_add_bots' ? `已加入 ${data} 个机器人` : `已移除 ${data} 个机器人`);
  }
  return (
    <Panel className="flex flex-col gap-3 border-dashed" aria-label="机器人沙盒">
      <h2 className="font-serif text-base font-bold tracking-wider text-gold-strong">机器人沙盒 · 仅开发版</h2>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => run('dev_add_bots')}>
          填充机器人
        </Button>
        <Button variant="ghost" onClick={() => run('dev_remove_bots')}>
          移除机器人
        </Button>
      </div>
      {notice ? (
        <p className="text-sm text-ink-muted" role="status">
          {notice}
        </p>
      ) : null}
    </Panel>
  );
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs on the DM's screen during setup and play: bots draw cards, raise hands at
 * random once per nomination, and sometimes post, all through the real functions.
 */
export function BotDriver({ game, bots }: { game: Game; bots: Map<number, string> }) {
  const { data } = useGameData(game.id);
  const [on, setOn] = useState(true);
  const busy = useRef(false);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!on || !data || busy.current || bots.size === 0) return;
    const jobs: (() => PromiseLike<unknown>)[] = [];

    // Draw: each bot without a card takes a random free one.
    if (game.status === 'setup' && game.assignment_mode === 'draw' && data.slots.length) {
      const drawn = new Set(data.slots.map((s) => s.taken_by_seat).filter(Boolean));
      const free = data.slots.filter((s) => !s.taken_by_seat).map((s) => s.card_no);
      for (const [seat, bot] of bots) {
        if (drawn.has(seat) || free.length === 0) continue;
        const card = free.splice(Math.floor(Math.random() * free.length), 1)[0]!;
        jobs.push(() =>
          supabase.rpc('dev_bot_draw', {
            p_game: game.id,
            p_bot: bot,
            p_card: card,
          }),
        );
      }
    }

    if (game.status === 'in_progress') {
      // Hands: each bot decides once per nomination, before the hand reaches it.
      const nom = openNomination(data);
      if (nom && (nom.status === 'open' || nom.status === 'voting')) {
        for (const [seat, bot] of bots) {
          const key = `${nom.id}:${seat}`;
          if (handled.current.has(key)) continue;
          handled.current.add(key);
          const s = data.seats.find((x) => x.seat === seat);
          const canRaise = s && (s.alive || !s.ghost_vote_used);
          if (canRaise && Math.random() < 0.6)
            jobs.push(() =>
              supabase.rpc('dev_bot_hand', {
                p_nomination: nom.id,
                p_bot: bot,
                p_raised: true,
              }),
            );
        }
      }
      // Posts: now and then, once per phase per bot.
      const phaseKey = `${game.phase_kind}${game.phase_number}`;
      for (const [seat, bot] of bots) {
        const key = `post:${phaseKey}:${seat}`;
        if (handled.current.has(key)) continue;
        handled.current.add(key);
        if (Math.random() < 0.25) {
          const line = LINES[Math.floor(Math.random() * LINES.length)]!;
          jobs.push(() =>
            supabase.rpc('dev_bot_post', {
              p_game: game.id,
              p_bot: bot,
              p_body: line,
            }),
          );
        }
      }
    }

    if (jobs.length === 0) return;
    busy.current = true;
    void (async () => {
      for (const job of jobs) {
        await job();
        await pause(120);
      }
      busy.current = false;
    })();
  }, [on, data, game, bots]);

  return (
    <label className="flex min-h-11 items-center gap-2 text-sm text-ink-muted">
      <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-4 accent-[var(--color-gold)]" />
      机器人自动行动（{bots.size} 个 · 仅开发版）
    </label>
  );
}
