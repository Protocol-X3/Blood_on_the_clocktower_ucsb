import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/components/ui/cn';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Ornament } from '@/components/ui/Ornament';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import { StarField } from '@/components/ui/StarField';
import { ThemeScope } from '@/components/ui/ThemeScope';
import { UserMenu } from '@/features/auth/UserMenu';
import type { Death, GameRole, GameSeat, LogEntry, SeatRole } from '@/features/game/useGameData';
import { entryPhase } from '@/features/grimoire/seats';
import { DEATH_CAUSE_LABEL, type DeathCause } from '@/features/live/model';
import { roleGlyph } from '@/lib/game/composition';
import { phaseLabel, type PhaseKind } from '@/lib/game/phase';
import { ALIGNMENT_LABEL, TEAM_LABEL } from '@/lib/game/teams';
import { supabase, type Game } from '@/services/supabase';
import { MessagePage } from './ComingSoon';

interface Summary {
  game: Game;
  seats: GameSeat[];
  roles: SeatRole[];
  library: GameRole[];
  deaths: Death[];
  log: LogEntry[];
  names: Map<string, string>;
}

type State = { status: 'loading' } | { status: 'none' } | { status: 'ready'; summary: Summary };

/**
 * 对局结算 (END-02 / END-03): the room's latest ended game, with every seat's actual
 * and shown role, final alignment, deaths and the winning team. Roles are readable
 * only by the game's participants (SECRET-03).
 */
export function SummaryPage() {
  const { code = '' } = useParams();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: room } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', code.toUpperCase())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: game } = room
        ? await supabase
            .from('games')
            .select('*')
            .eq('room_id', room.id)
            .eq('status', 'ended')
            .order('ended_at', { ascending: false })
            .limit(1)
            .maybeSingle()
        : { data: null };
      if (!game) {
        if (!cancelled) setState({ status: 'none' });
        return;
      }
      const [seats, roles, library, deaths, log] = await Promise.all([
        supabase.from('game_seats').select('*').eq('game_id', game.id).order('seat'),
        supabase.from('seat_roles').select('*').eq('game_id', game.id).order('seat'),
        supabase.from('game_roles').select('*').eq('game_id', game.id),
        supabase.from('game_deaths').select('*').eq('game_id', game.id).order('id'),
        supabase.from('dm_log').select('*').eq('game_id', game.id).order('created_at'),
      ]);
      const ids = (seats.data ?? []).map((s) => s.user_id).filter((x): x is string => !!x);
      const { data: profiles } = ids.length ? await supabase.from('profiles').select('id, nickname').in('id', ids) : { data: [] };
      if (cancelled) return;
      setState({
        status: 'ready',
        summary: {
          game,
          seats: seats.data ?? [],
          roles: roles.data ?? [],
          library: library.data ?? [],
          deaths: deaths.data ?? [],
          log: log.data ?? [],
          names: new Map((profiles ?? []).map((p) => [p.id, p.nickname ?? ''])),
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (state.status === 'loading') return <LoadingScreen label="正在载入结算…" />;
  if (state.status === 'none') return <MessagePage title="暂无结算" message="这个房间还没有结束的对局。" />;
  const { game, seats, roles, library, deaths, log, names } = state.summary;
  const roleById = new Map(library.map((r) => [r.role_id, r]));
  const roleOf = new Map(roles.map((r) => [r.seat, r]));
  const good = game.winner === 'good';

  return (
    <ThemeScope theme="night" className="relative min-h-dvh overflow-hidden">
      <StarField count={40} seed={9} />
      <div className="relative mx-auto flex min-h-dvh max-w-3xl flex-col pb-12">
        <PageHeader>
          <UserMenu />
        </PageHeader>
        <header className="px-5 pt-2 text-center">
          <p className="text-xs tracking-[0.4em] text-ink-faint">对局结算 · {code.toUpperCase()}</p>
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
                  <li
                    key={s.seat}
                    data-testid={`summary-seat-${s.seat}`}
                    className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                  >
                    <span className="w-8 font-serif font-bold text-gold-strong">{s.seat}号</span>
                    {actual ? <RoleToken glyph={roleGlyph(actual)} team={actual.team} label={actual.name} size="sm" dead={!s.alive} /> : null}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{(s.user_id && names.get(s.user_id)) || '已删除用户'}</p>
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
          {log.length ? (
            <Panel className="flex flex-col gap-3" aria-label="说书人日志">
              <h2 className="font-serif text-lg font-bold tracking-wider text-gold-strong">说书人日志</h2>
              <ol className="flex flex-col gap-2">
                {log.map((e) => {
                  const who = e.seat ? seats.find((x) => x.seat === e.seat) : undefined;
                  return (
                    <li key={e.id} data-testid="summary-log" className="flex gap-3 text-sm">
                      <span className="w-12 shrink-0 text-xs text-ink-faint">{entryPhase(e)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-ink-faint">{e.seat ? `${e.seat}号 ${(who?.user_id && names.get(who.user_id)) || ''}` : '整局'}</span>
                        <span className="break-words whitespace-pre-wrap">{e.body}</span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </Panel>
          ) : null}
          <Button asChild variant="outline" size="lg">
            <Link to={`/room/${code.toUpperCase()}`}>返回房间</Link>
          </Button>
        </main>
      </div>
    </ThemeScope>
  );
}
