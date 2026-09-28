import type { ReactNode } from 'react';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/components/ui/cn';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import type { GameData } from '@/features/game/useGameData';
import { circleSeats } from '@/features/live/model';
import { SeatCircle, type CircleSeat } from '@/features/live/SeatCircle';
import { useWidth } from '@/features/live/useWidth';
import { TEAM_LABEL, type Team } from '@/lib/game/teams';
import { grimoireSeats, type GrimoireSeat } from './seats';
import { useWide } from './useWide';

const TEAM_TEXT: Record<Team, string> = {
  townsfolk: 'text-townsfolk-text',
  outsider: 'text-outsider-text',
  minion: 'text-minion-text',
  demon: 'text-demon-text',
};

/** A seat's reminder tokens as small chips (GRIM-02). */
export function TokenChips({ seat, className }: { seat: GrimoireSeat; className?: string }) {
  if (!seat.tokens.length) return null;
  return (
    <span className={cn('flex flex-wrap justify-center gap-1', className)} data-testid={`tokens-${seat.seat}`}>
      {seat.tokens.map((t) => (
        <Chip key={t.id} tone={t.kind === 'poisoned' || t.kind === 'drunk' ? 'blood' : 'gold'} className="px-1.5 py-0 text-[11px] leading-4">
          {t.label}
        </Chip>
      ))}
    </span>
  );
}

function circleDetail(s: GrimoireSeat): ReactNode {
  return (
    <>
      <span className={cn('max-w-full truncate rounded-md bg-bg px-1.5 text-xs', s.alive ? 'text-ink' : 'text-ink-faint')}>
        {s.seat}号 {s.name}
      </span>
      {s.actual ? (
        <span className={cn('max-w-full truncate rounded-md bg-bg px-1.5 text-[11px]', TEAM_TEXT[s.actual.team])}>
          {s.actual.name}
          {s.shown ? <span className="text-ink-faint"> · 展示：{s.shown.name}</span> : null}
        </span>
      ) : null}
      {s.alignmentNote ? (
        <Chip tone={s.alignment === 'evil' ? 'demon' : 'townsfolk'} className="px-1.5 py-0 text-[11px] leading-4">
          {s.alignmentNote}
        </Chip>
      ) : null}
      {!s.alive ? (
        <span className="rounded-md bg-bg px-1.5 text-[11px] text-ink-faint">
          {s.status} · {s.ghostVoteUsed ? '票已用' : '有幽灵票'}
        </span>
      ) : null}
      <TokenChips seat={s} />
    </>
  );
}

/**
 * The grimoire (GRIM-01 / GRIM-02): a circle of seats, clockwise from the top, on
 * screens 1024 px wide or more; a list otherwise. Selecting a seat opens its panel (GRIM-03).
 */
export function Grimoire({
  data,
  names,
  selected,
  onSelect,
  sweep,
  center,
}: {
  data: GameData;
  names: Map<number, string>;
  selected: number | null;
  onSelect: (seat: number) => void;
  sweep: { from: number; passed: number } | null;
  center: ReactNode;
}) {
  const wide = useWide();
  const [ref, width] = useWidth<HTMLDivElement>(640);
  const seats = grimoireSeats(data, names);
  const bySeat = new Map(seats.map((s) => [s.seat, s]));
  const circle: CircleSeat[] = circleSeats(data, names, {
    selected,
    roles: new Map(seats.flatMap((s) => (s.actual ? [[s.seat, { glyph: s.glyph, team: s.actual.team }] as const] : []))),
  }).map((c) => ({ ...c, detail: circleDetail(bySeat.get(c.seat)!) }));

  if (wide) {
    const size = Math.min(680, width);
    return (
      <div ref={ref} data-testid="grimoire" data-layout="circle">
        <SeatCircle label="魔典座位" size={size} tokenSize={size < 560 ? 52 : 60} seats={circle} onSelect={onSelect} sweep={sweep} center={center} />
      </div>
    );
  }

  return (
    <div ref={ref} data-testid="grimoire" data-layout="list" className="flex flex-col gap-4">
      <Panel className="text-center">{center}</Panel>
      <Panel padding="none" aria-label="魔典座位">
        <ul>
          {seats.map((s) => {
            const vote = circle.find((c) => c.seat === s.seat)!;
            return (
              <li key={s.seat} className="border-b border-line last:border-b-0" data-testid={`grimoire-seat-${s.seat}`}>
                <button
                  type="button"
                  onClick={() => onSelect(s.seat)}
                  aria-label={`${s.seat}号 ${s.name}${s.alive ? '' : '（已死亡）'}`}
                  className={cn('flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left', selected === s.seat && 'bg-gold/10')}
                >
                  <span className="w-8 shrink-0 font-serif font-bold text-gold-strong">{s.seat}号</span>
                  {s.actual ? <RoleToken glyph={s.glyph} team={s.actual.team} label={s.actual.name} size="sm" dead={!s.alive} /> : null}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
                      {s.actual ? (
                        <span>
                          {s.actual.name} · {TEAM_LABEL[s.actual.team]}
                          {s.shown ? ` · 展示：${s.shown.name}` : ''}
                        </span>
                      ) : null}
                      {s.alignmentNote ? <Chip tone={s.alignment === 'evil' ? 'demon' : 'townsfolk'}>{s.alignmentNote}</Chip> : null}
                      {!s.alive ? (
                        <span>
                          {s.status} · {s.ghostVoteUsed ? '票已用' : '有幽灵票'}
                        </span>
                      ) : null}
                      {vote.raised ? <Chip tone="gold">已举手</Chip> : null}
                    </span>
                    <TokenChips seat={s} className="justify-start" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
