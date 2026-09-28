import { useState } from 'react';
import { cn } from '@/components/ui/cn';
import { Ornament } from '@/components/ui/Ornament';
import { useGameData } from '@/features/game/useGameData';
import { RoleCard } from '@/features/roles/RoleCard';
import { errorMessage } from '@/services/errors';
import { supabase, type Game } from '@/services/supabase';

/** A player's screen during setup: the card draw (DRAW-02..04) or a waiting message. */
export function PlayerSetup({ game, mySeat, seatNames }: { game: Game; mySeat: number | null; seatNames: Map<number, string> }) {
  const { data, reload } = useGameData(game.id);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return null;

  const mine = data.shown[0];
  const myRole = mine ? data.roles.find((r) => r.role_id === mine.shown_role_id) : undefined;

  if (game.assignment_mode !== 'draw') {
    return <Waiting title="说书人正在配置对局" text="开始游戏后，你会在这里看到自己的角色。" />;
  }
  if (myRole) {
    return (
      <div className="flex flex-col items-center gap-4">
        <p className="text-sm tracking-[0.2em] text-ink-muted">你抽到了</p>
        <div className="w-full motion-safe:animate-flip-in">
          <RoleCard role={myRole} />
        </div>
        <p className="text-sm text-ink-muted">请勿向他人展示 · 等待说书人开始游戏</p>
      </div>
    );
  }
  if (data.slots.length === 0) return <Waiting title="等待说书人发牌" text="发牌后，轻触一张牌翻开你的身份。" />;
  if (!mySeat) return <Waiting title="正在抽卡" text="你没有入座，本局旁观。" />;

  async function draw(card: number) {
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.rpc('draw_card', { p_game: game.id, p_card: card });
    setBusy(false);
    if (error) setNotice(errorMessage(error));
    await reload();
  }

  return (
    <section className="flex flex-col items-center gap-4" aria-label="抽卡">
      <h2 className="font-serif text-2xl font-black tracking-[0.2em] text-gold-strong">抽取角色</h2>
      <p className="text-sm text-ink-muted">轻触一张牌，翻开你的身份。</p>
      <ul className="flex max-w-sm flex-wrap justify-center gap-3">
        {data.slots.map((slot) => {
          const takenBy = slot.taken_by_seat;
          return (
            <li key={slot.card_no}>
              {takenBy ? (
                <div
                  data-testid={`card-${slot.card_no}`}
                  className="flex h-32 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-surface-2/60 text-xs text-ink-faint"
                >
                  <CardEmblem dim />
                  {takenBy}号已抽
                  <span className="sr-only">{seatNames.get(takenBy)}</span>
                </div>
              ) : (
                <button
                  type="button"
                  data-testid={`card-${slot.card_no}`}
                  aria-label={`抽取第 ${slot.card_no} 张牌`}
                  disabled={busy}
                  onClick={() => draw(slot.card_no)}
                  className={cn(
                    'grid h-32 w-24 place-items-center rounded-xl border border-[#c9a55a] bg-[#151c33] transition-transform',
                    'shadow-[inset_0_0_0_5px_#151c33,inset_0_0_0_6px_rgb(201_165_90/0.5),0_10px_22px_rgb(0_0_0/0.45)] hover:-translate-y-1',
                  )}
                >
                  <CardEmblem />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {notice ? (
        <p role="alert" className="text-sm text-blood-text">
          {notice}
        </p>
      ) : null}
    </section>
  );
}

function Waiting({ title, text }: { title: string; text: string }) {
  return (
    <section className="flex flex-col items-center gap-3 py-10 text-center" role="status">
      <h2 className="font-serif text-2xl font-black tracking-[0.2em] text-gold-strong">{title}</h2>
      <Ornament />
      <p className="text-sm text-ink-muted">{text}</p>
    </section>
  );
}

function CardEmblem({ dim }: { dim?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 52 52" className="size-12" fill="none" stroke={dim ? '#3a4466' : '#c9a55a'} strokeLinecap="round">
      <circle cx="26" cy="26" r="20" strokeWidth="1.2" />
      <circle cx="26" cy="26" r="15" strokeWidth="0.8" opacity="0.6" />
      <path d="M26 8v3M26 41v3M8 26h3M41 26h3" strokeWidth="1" />
      <path d="M26 26V16M26 26l6 4" strokeWidth="1.8" />
    </svg>
  );
}
