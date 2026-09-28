import type { ReactNode } from 'react';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/components/ui/cn';
import { Ornament } from '@/components/ui/Ornament';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import { StarField } from '@/components/ui/StarField';
import { ThemeScope } from '@/components/ui/ThemeScope';
import { UserMenu } from '@/features/auth/UserMenu';
import { entryPhase } from '@/features/grimoire/seats';
import { DEATH_CAUSE_LABEL, postPhase, timeOf, type DeathCause } from '@/features/live/model';
import { roleGlyph } from '@/lib/game/composition';
import { phaseLabel, type PhaseKind } from '@/lib/game/phase';
import { ALIGNMENT_LABEL, TEAM_LABEL } from '@/lib/game/teams';
import type { GameRecord } from './loadGame';

/** HIST-06: a seat whose player deleted their account. */
export const DELETED_USER = '已删除用户';

/**
 * An ended game: the winner, every seat's actual and shown role, final alignment and
 * deaths (END-03), the DM log (LOG-02) and, on the history page, the nominations with
 * their counts and the board (HIST-03).
 */
export function GameReport({ record, eyebrow, full, footer }: { record: GameRecord; eyebrow: string; full: boolean; footer?: ReactNode }) {
  const { game, seats, roles, library, deaths, log, nominations, dayResults, posts, names } = record;
  const roleById = new Map(library.map((r) => [r.role_id, r]));
  const roleOf = new Map(roles.map((r) => [r.seat, r]));
  const nameOf = (seat: number | null) => {
    const s = seats.find((x) => x.seat === seat);
    return (s?.user_id && names.get(s.user_id)) || DELETED_USER;
  };
  const good = game.winner === 'good';

  return (
    <ThemeScope theme="night" className="relative min-h-dvh overflow-hidden">
      <StarField count={40} seed={9} />
      <div className="relative mx-auto flex min-h-dvh max-w-3xl flex-col pb-12">
        <PageHeader>
          <UserMenu />
        </PageHeader>
        <header className="px-5 pt-2 text-center">
          <p className="text-xs tracking-[0.4em] text-ink-faint">{eyebrow}</p>
          <h1
            className={cn('mt-2 font-serif text-4xl font-black tracking-[0.2em]', good ? 'text-townsfolk-text' : 'text-demon-text')}
            data-testid="winner"
          >
            {good ? '善良' : '邪恶'}阵营获胜
          </h1>
          <Ornament className="mx-auto mt-4" />
        </header>

        <main className="mt-6 flex flex-col gap-5 px-4">
          {roles.length === 0 ? (
            <Panel>
              <p className="text-sm text-ink-muted" role="status">
                只有本局的玩家和说书人可以查看角色。
              </p>
            </Panel>
          ) : null}
          <Panel padding="none" aria-label="座位结算">
            <ol>
              {seats.map((s) => {
                const sr = roleOf.get(s.seat);
                const actual = sr ? roleById.get(sr.actual_role_id) : undefined;
                const shown = sr && sr.shown_role_id !== sr.actual_role_id ? roleById.get(sr.shown_role_id) : undefined;
                const won = sr ? sr.alignment === game.winner : null;
                const myDeaths = deaths.filter((d) => d.seat === s.seat);
                return (
                  <li key={s.seat} data-testid={`summary-seat-${s.seat}`} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                    <span className="w-8 font-serif font-bold text-gold-strong">{s.seat}号</span>
                    {actual ? <RoleToken glyph={roleGlyph(actual)} team={actual.team} label={actual.name} size="sm" dead={!s.alive} /> : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{nameOf(s.seat)}</p>
                      {actual && sr ? (
                        <p className="text-sm text-ink-muted">
                          {actual.name} · {TEAM_LABEL[actual.team]}
                          {shown ? ` · 展示：${shown.name}` : ''} · {ALIGNMENT_LABEL[sr.alignment]}
                        </p>
                      ) : null}
                      {myDeaths.length ? (
                        <p className="text-xs text-ink-faint">
                          {myDeaths
                            .map(
                              (d) =>
                                `${phaseLabel({ kind: d.phase_kind as PhaseKind, number: d.phase_number })} ${DEATH_CAUSE_LABEL[d.cause as DeathCause]}${d.note ? `（${d.note}）` : ''}${d.revived ? ' · 已复活' : ''}`,
                            )
                            .join('；')}
                        </p>
                      ) : null}
                    </div>
                    {won === null ? null : <Chip tone={won ? 'gold' : 'neutral'}>{won ? '胜' : '负'}</Chip>}
                  </li>
                );
              })}
            </ol>
          </Panel>

          {full ? (
            <Panel className="flex flex-col gap-3" aria-label="提名与投票">
              <h2 className="font-serif text-lg font-bold tracking-wider text-gold-strong">提名与投票</h2>
              {nominations.length === 0 ? <p className="text-sm text-ink-faint">本局没有投票</p> : null}
              <ol className="flex flex-col gap-2">
                {nominations.map((n) => {
                  const executed = dayResults.find((d) => d.day_number === n.day_number)?.executed_seat === n.nominee_seat;
                  return (
                    <li key={n.id} data-testid="history-nomination" className="flex items-center gap-3 text-sm">
                      <span className="w-12 shrink-0 text-xs text-ink-faint">第{n.day_number}天</span>
                      <span className="min-w-0 flex-1">
                        {n.nominator_seat}号 {nameOf(n.nominator_seat)} → {n.nominee_seat}号 {nameOf(n.nominee_seat)}
                      </span>
                      <span className="shrink-0 text-ink-muted">
                        {n.vote_count} 票 / 需 {n.threshold}
                      </span>
                      {executed ? <Chip tone="blood">处决</Chip> : null}
                    </li>
                  );
                })}
              </ol>
            </Panel>
          ) : null}

          {log.length ? (
            <Panel className="flex flex-col gap-3" aria-label="说书人日志">
              <h2 className="font-serif text-lg font-bold tracking-wider text-gold-strong">说书人日志</h2>
              <ol className="flex flex-col gap-2">
                {log.map((e) => (
                  <li key={e.id} data-testid="summary-log" className="flex gap-3 text-sm">
                    <span className="w-12 shrink-0 text-xs text-ink-faint">{entryPhase(e)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-ink-faint">{e.seat ? `${e.seat}号 ${nameOf(e.seat)}` : '整局'}</span>
                      <span className="break-words whitespace-pre-wrap">{e.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>
          ) : null}

          {full ? (
            <Panel className="flex flex-col gap-3" aria-label="公告板">
              <h2 className="font-serif text-lg font-bold tracking-wider text-gold-strong">公告板</h2>
              {posts.length === 0 ? <p className="text-sm text-ink-faint">没有帖子</p> : null}
              <ol className="flex flex-col gap-2">
                {posts.map((p) => (
                  <li key={p.id} data-testid="history-post" className="flex flex-col gap-1 rounded-xl border border-line bg-surface-2 px-3 py-2">
                    <span className="flex gap-2 text-xs text-ink-faint">
                      <b className={p.is_dm ? 'text-gold-strong' : 'text-ink'}>{p.is_dm ? '说书人' : `${p.seat}号 ${nameOf(p.seat)}`}</b>
                      <span>{postPhase(p)}</span>
                      <span>{timeOf(p.created_at)}</span>
                    </span>
                    <span className="text-[15px] break-words whitespace-pre-wrap">{p.body}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          ) : null}
          {footer}
        </main>
      </div>
    </ThemeScope>
  );
}
