import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import type { Team } from '@/lib/game/teams';

const TEAM_RIM: Record<Team, string> = {
  townsfolk: 'border-townsfolk',
  outsider: 'border-outsider',
  minion: 'border-minion',
  demon: 'border-demon',
};

/** idle: no nomination; none: the hand has not reached this seat yet. */
export type SeatVoteState = 'idle' | 'none' | 'raised' | 'locked-yes' | 'locked-no' | 'current' | 'nominee';

export interface CircleSeat {
  seat: number;
  /** Short label under or inside the token. */
  label: string;
  alive: boolean;
  ghostVoteUsed: boolean;
  vote: SeatVoteState;
  /** Raised hand not yet locked. */
  raised: boolean;
  mine?: boolean;
  selected?: boolean;
  /** Replaces the seat number inside the token (e.g. a role glyph on the DM's screen). */
  token?: ReactNode;
  /** On the DM's screen: the actual role's team, for a parchment token with a team-coloured rim. */
  team?: Team;
  /** On the grimoire: what to show under the token instead of the name (GRIM-02). */
  detail?: ReactNode;
}

interface Props {
  seats: CircleSeat[];
  /** Diameter in px. */
  size: number;
  /** Token diameter in px. */
  tokenSize?: number;
  /** The circle's first seat (clock hand start) and how many seats the hand has passed. */
  sweep?: { from: number; passed: number } | null;
  center?: ReactNode;
  onSelect?: (seat: number) => void;
  label: string;
}

const polar = (cx: number, r: number, index: number, count: number) => {
  const a = ((-90 + (index * 360) / count) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cx + r * Math.sin(a), a };
};

/**
 * The town square: seats clockwise from the top, in seat order. During a vote the
 * clock hand sweeps from the seat after the nominee (VOTE-03), gilding the arc it
 * has passed; locked raised hands turn gold (VOTE-04). Dead seats are greyed with a
 * 亡 shroud (DEATH-03).
 */
export function SeatCircle({ seats, size, tokenSize = 40, sweep, center, onSelect, label }: Props) {
  const n = seats.length;
  const large = tokenSize >= 48;
  const badge = large ? 'size-6 text-[11px]' : 'size-[18px] text-[9px]';
  const c = size / 2;
  const r = c - tokenSize / 2 - 6;
  const ring = r - tokenSize / 2 - 10;

  let arc: string | null = null;
  let hand: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (sweep && n > 0) {
    // The hand points at the seat it is about to pass.
    const startIndex = sweep.from - 1;
    const at = Math.min(sweep.passed, n);
    const start = polar(c, ring, startIndex - 0.5, n);
    const end = polar(c, ring, startIndex + at - 0.5, n);
    if (at > 0 && at < n) {
      const largeArc = (at * 360) / n > 180 ? 1 : 0;
      arc = `M ${start.x} ${start.y} A ${ring} ${ring} 0 ${largeArc} 1 ${end.x} ${end.y}`;
    } else if (at >= n) {
      arc = `M ${c} ${c - ring} A ${ring} ${ring} 0 1 1 ${c - 0.01} ${c - ring}`;
    }
    if (at < n) {
      const tip = polar(c, ring, startIndex + at, n);
      const base = polar(c, ring * 0.45, startIndex + at, n);
      hand = { x1: base.x, y1: base.y, x2: tip.x, y2: tip.y };
    }
  }

  return (
    <div className="relative mx-auto" style={{ width: size, height: size, marginBottom: large ? (seats.some((x) => x.detail) ? 76 : 24) : 0 }} role="group" aria-label={label}>
      <svg aria-hidden="true" width={size} height={size} className="absolute inset-0">
        <circle cx={c} cy={c} r={ring} fill="none" stroke="var(--color-line)" strokeWidth="1.5" strokeDasharray="3 5" />
        {arc ? <path d={arc} fill="none" stroke="var(--color-gold)" strokeWidth="3" strokeLinecap="round" opacity="0.8" /> : null}
        {hand ? (
          <line {...hand} stroke="var(--color-blood)" strokeWidth="2.5" strokeLinecap="round" className="transition-all duration-300 ease-out" />
        ) : null}
      </svg>
      {center ? (
        <div
          className="absolute grid place-items-center rounded-full border border-line bg-surface-2 text-center"
          style={{
            left: c - ring * 0.62,
            top: c - ring * 0.62,
            width: ring * 1.24,
            height: ring * 1.24,
          }}
        >
          {center}
        </div>
      ) : null}
      <ol className="contents">
        {seats.map((s, i) => {
          const p = polar(c, r, i, n);
          const Tag = onSelect ? 'button' : 'span';
          return (
            <li
              key={s.seat}
              className="absolute"
              style={{
                left: p.x - tokenSize / 2,
                top: p.y - tokenSize / 2,
                width: tokenSize,
                height: tokenSize,
              }}
              data-testid={`circle-seat-${s.seat}`}
              data-vote={s.vote}
              data-alive={s.alive ? 'true' : 'false'}
              data-raised={s.raised ? 'true' : 'false'}
            >
              <Tag
                type={onSelect ? 'button' : undefined}
                onClick={onSelect ? () => onSelect(s.seat) : undefined}
                aria-label={`${s.seat}号 ${s.label}${s.alive ? '' : '（已死亡）'}${s.raised ? '，已举手' : ''}`}
                className={cn(
                  'grid size-full place-items-center rounded-full border-2 font-serif text-[15px] font-bold transition-[background-color,border-color,filter,opacity,box-shadow] duration-500',
                  s.vote === 'locked-yes' && 'border-gold-strong bg-gold text-gold-ink shadow-[0_0_0_4px_var(--gold-glow)]',
                  s.vote === 'locked-no' && 'border-line bg-surface-2 text-ink-faint',
                  s.vote === 'current' && 'animate-pulse-ring border-blood bg-surface text-blood-text',
                  s.vote === 'nominee' && 'border-blood bg-blood text-white',
                  s.vote === 'none' && !s.team && 'border-dashed border-line bg-surface text-ink',
                  s.vote === 'idle' && !s.team && 'border-line bg-surface text-ink',
                  (s.vote === 'idle' || s.vote === 'none') && s.team && ['border-[3px] bg-parchment text-parchment-ink', TEAM_RIM[s.team]],
                  large && 'text-[22px] font-black',
                  s.mine && s.vote !== 'locked-yes' && 'border-solid border-townsfolk',
                  s.selected && 'ring-2 ring-gold ring-offset-2 ring-offset-bg',
                  !s.alive && 'opacity-60 grayscale',
                  onSelect && 'cursor-pointer',
                )}
              >
                {s.token ?? s.seat}
              </Tag>
              {large && s.detail ? (
                <div className="absolute top-full left-1/2 mt-1 flex w-32 -translate-x-1/2 flex-col items-center gap-0.5 text-center">{s.detail}</div>
              ) : large ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-full left-1/2 mt-1 max-w-28 -translate-x-1/2 truncate rounded-md bg-bg px-1.5 text-center text-xs whitespace-nowrap',
                    s.alive ? 'text-ink-muted' : 'text-ink-faint',
                  )}
                >
                  {s.seat}号 {s.label}
                </span>
              ) : null}
              {s.raised ? (
                <span
                  aria-hidden="true"
                  className={cn('absolute -top-1.5 -right-1.5 grid place-items-center rounded-full border-2 border-surface bg-gold', badge)}
                >
                  <svg
                    viewBox="0 0 10 10"
                    className="size-2.5"
                    fill="none"
                    stroke="var(--color-gold-ink)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 8.5V1.8M2.2 4.4 5 1.6l2.8 2.8" />
                  </svg>
                </span>
              ) : null}
              {!s.alive ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute -bottom-1.5 -left-1.5 grid place-items-center rounded-full border-2 border-surface font-serif font-bold',
                    badge,
                    s.ghostVoteUsed ? 'bg-ink-faint text-bg' : 'bg-parchment-ink text-parchment',
                  )}
                >
                  亡
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
