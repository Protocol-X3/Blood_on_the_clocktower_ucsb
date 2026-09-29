import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import type { GameData, Nomination } from '@/features/game/useGameData';
import { roleGlyph } from '@/lib/game/composition';
import { nextPhase, phaseLabel, type PhaseKind } from '@/lib/game/phase';
import { ALIGNMENT_LABEL } from '@/lib/game/teams';
import { circleOrder, clampVoteSpeed, NOMINATION_WARNING_TEXT, nominationWarnings, VOTE_SPEED, voteThreshold } from '@/lib/game/vote';
import { supabase, type Game } from '@/services/supabase';
import { Board } from './Board';
import {
  blockToday,
  currentSeat,
  liveCount,
  openNomination,
  todays,
  votesOf,
} from './model';
import { Grimoire } from '@/features/grimoire/Grimoire';
import { LogPanel } from '@/features/grimoire/Log';
import { logIndex, logRows } from '@/features/grimoire/logData';
import { LogSheet } from '@/features/grimoire/LogSheet';
import { SeatDetail } from '@/features/grimoire/SeatDetail';

type Act = (run: () => PromiseLike<{ error: unknown }>, after?: () => void) => Promise<void>;
type Tab = 'nominate' | 'seat' | 'players' | 'log' | 'board';

/**
 * VOTE-05 / VOTE-12: the DM's screen drives the clock hand, one advance_vote per tick.
 * If this device sleeps or goes offline, nothing ticks and the circle simply waits at
 * the same seat; it carries on from there when the screen is back.
 */
function useVoteClock(nom: Nomination | undefined, speed: number, reload: () => void) {
  const id = nom?.id;
  const running = nom?.status === 'voting' && !nom.paused;
  const hand = nom?.hand_index;
  // Bumped after a failed tick (e.g. offline), so the clock tries again.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!id || !running || hand === undefined) return;
    const timer = setTimeout(async () => {
      const { error } = await supabase.rpc('advance_vote', {
        p_nomination: id,
        p_expected: hand,
      });
      if (error) setAttempt((a) => a + 1);
      reload();
    }, speed);
    return () => clearTimeout(timer);
  }, [id, running, hand, speed, reload, attempt]);
}

/** The DM's live console (laptop / iPad): the town square, seat actions, nominations and the vote, the board. */
export function DmLive({
  game,
  data,
  me,
  names,
  act,
  reload,
}: {
  game: Game;
  data: GameData;
  me: string;
  names: Map<number, string>;
  act: Act;
  reload: () => void;
}) {
  // At night the DM mostly needs the roles; by day, the nominations.
  const [tab, setTab] = useState<Tab>(game.phase_kind === 'day' ? 'nominate' : 'players');
  const [selected, setSelected] = useState<number | null>(null);
  const [ending, setEnding] = useState(false);
  const phase = {
    kind: (game.phase_kind ?? 'night') as PhaseKind,
    number: game.phase_number ?? 1,
  };
  const nom = openNomination(data);
  const votes = votesOf(data, nom);
  const living = data.seats.filter((s) => s.alive).length;
  const speed = clampVoteSpeed(game.vote_speed_ms ?? VOTE_SPEED.default);
  useVoteClock(nom, speed, reload);

  const current = currentSeat(nom, data.seats.length);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="flex flex-col gap-4">
        <Panel className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="对局状态">
          <span className="text-sm text-ink-muted">
            {data.seats.length} 人 · 存活 {living} · 处决需 {voteThreshold(living)} 票
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button disabled={!!nom} onClick={() => act(() => supabase.rpc('advance_phase', { p_game: game.id }))}>
              进入{phaseLabel(nextPhase(phase))}
            </Button>
            <Button variant="ghost" onClick={() => setEnding(true)}>
              结束游戏
            </Button>
          </div>
        </Panel>

        <Grimoire
          data={data}
          names={names}
          selected={selected}
          onSelect={(s) => {
            setSelected(s);
            setTab('seat');
          }}
          sweep={nom && nom.status !== 'open' ? { from: (nom.nominee_seat % data.seats.length) + 1, passed: nom.hand_index } : null}
          center={
              nom ? (
                <div className="flex flex-col items-center gap-1" data-testid="dm-vote-center">
                  <span className={cn('text-xs font-bold tracking-[0.3em]', nom.status === 'voting' ? 'text-blood-text' : 'text-gold-strong')}>
                    {nom.status === 'open' ? '提名中' : nom.status === 'voting' ? '计票中' : '计票完成'}
                  </span>
                  <span className="text-sm text-ink-muted">
                    {nom.nominator_seat}号 → {nom.nominee_seat}号
                  </span>
                  <span className="font-serif text-5xl font-black text-gold-strong">
                    {nom.status === 'open' ? [...votes.values()].filter((v) => v.raised).length : liveCount(nom, votes)}
                    <span className="text-xl text-ink-faint"> / {nom.threshold ?? voteThreshold(living)}</span>
                  </span>
                  {current ? (
                    <span className="text-xs text-ink-faint">
                      指针：{current}号 {names.get(current)}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="font-serif text-2xl font-black tracking-[0.2em] text-gold-strong">{phaseLabel(phase)}</span>
                  <span className="mt-1 text-xs text-ink-faint">轻触座位查看详情</span>
                </div>
              )
          }
        />
      </div>

      <aside className="flex flex-col gap-4">
        <nav className="flex gap-5 border-b border-line" role="tablist" aria-label="说书人面板">
          {(
            [
              ['nominate', '提名'],
              ['seat', '座位'],
              ['players', '玩家'],
              ['log', '日志'],
              ['board', '公告板'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                '-mb-px min-h-11 border-b-2 px-1 text-sm',
                tab === key ? 'border-gold font-bold text-gold-strong' : 'border-transparent text-ink-muted',
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'nominate' ? <NominationPanel game={game} data={data} names={names} act={act} speed={speed} /> : null}
        {tab === 'seat' ? <SeatDetail game={game} data={data} names={names} seat={selected} act={act} onPick={setSelected} /> : null}
        {tab === 'players' ? <SeatRoleList data={data} names={names} /> : null}
        {tab === 'log' ? <LogPanel key={phaseLabel(phase)} gameId={game.id} data={data} names={names} phase={phase} act={act} /> : null}
        {tab === 'board' ? <Board posts={data.posts} names={names} me={me} isDm canPost act={act} gameId={game.id} /> : null}
      </aside>

      {/* LOG-04: the full log table, below everything, full width. */}
      <div className="mt-3 min-w-0 lg:col-span-2">
        <LogSheet {...logRows(data, names)} index={logIndex(data)} phase={phase} edit={{ gameId: game.id, act }} />
      </div>

      {ending ? <EndGameDialog gameId={game.id} act={act} onClose={() => setEnding(false)} /> : null}
    </div>
  );
}

function NominationPanel({ game, data, names, act, speed }: { game: Game; data: GameData; names: Map<number, string>; act: Act; speed: number }) {
  const day = game.phase_number ?? 1;
  const nom = openNomination(data);
  const votes = votesOf(data, nom);
  const today = todays(data, day);
  const block = blockToday(data, day);
  const result = data.dayResults.find((d) => d.day_number === day);
  const seatNos = data.seats.map((s) => s.seat);
  const [nominator, setNominator] = useState<number>(seatNos[0] ?? 1);
  const [nominee, setNominee] = useState<number>(seatNos[1] ?? 1);
  const nominatorAlive = data.seats.find((s) => s.seat === nominator)?.alive ?? true;
  const warnings = nominationWarnings(
    today.map((n) => ({
      nominator: n.nominator_seat,
      nominee: n.nominee_seat,
    })),
    nominator,
    nominee,
    nominatorAlive,
  );

  if (game.phase_kind !== 'day') {
    return (
      <Panel>
        <p className="text-sm text-ink-muted">夜晚不能提名。进入白天后可以发起提名。</p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!nom && !result ? (
        <Panel className="flex flex-col gap-3" aria-label="发起提名">
          <div className="grid grid-cols-2 gap-3">
            <SeatSelect label="提名者" value={nominator} onChange={setNominator} seats={seatNos} names={names} />
            <SeatSelect label="被提名者" value={nominee} onChange={setNominee} seats={seatNos} names={names} />
          </div>
          {warnings.length ? (
            <ul role="status" className="flex flex-col gap-1 rounded-xl border border-blood/40 bg-blood/10 px-3 py-2 text-sm text-blood-text">
              {warnings.map((w) => (
                <li key={w}>⚠ {NOMINATION_WARNING_TEXT[w]}（仍可提名）</li>
              ))}
            </ul>
          ) : null}
          <Button
            onClick={() =>
              act(() =>
                supabase.rpc('open_nomination', {
                  p_game: game.id,
                  p_nominator: nominator,
                  p_nominee: nominee,
                }),
              )
            }
          >
            发起提名
          </Button>
        </Panel>
      ) : null}

      {nom ? (
        <Panel className="flex flex-col gap-3" aria-label="当前提名">
          <p className="font-serif text-lg font-bold">
            {nom.nominator_seat}号 {names.get(nom.nominator_seat)} 提名{' '}
            <span className="text-blood-text">
              {nom.nominee_seat}号 {names.get(nom.nominee_seat)}
            </span>
          </p>
          {nom.status === 'open' ? (
            <>
              <p className="text-sm text-ink-muted">
                玩家可以自由举手。举手：
                {[...votes.values()].filter((v) => v.raised).length} 人
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => act(() => supabase.rpc('start_vote', { p_nomination: nom.id }))}>
                  开始计票
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    act(() =>
                      supabase.rpc('cancel_nomination', {
                        p_nomination: nom.id,
                      }),
                    )
                  }
                >
                  取消提名
                </Button>
              </div>
              <SpeedControl gameId={game.id} speed={speed} act={act} />
            </>
          ) : null}
          {nom.status === 'voting' ? (
            <>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    act(() =>
                      supabase.rpc('set_vote_paused', {
                        p_nomination: nom.id,
                        p_paused: !nom.paused,
                      }),
                    )
                  }
                >
                  {nom.paused ? '继续' : '暂停'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    act(() =>
                      supabase.rpc('advance_vote', {
                        p_nomination: nom.id,
                        p_expected: nom.hand_index,
                      }),
                    )
                  }
                >
                  下一位
                </Button>
              </div>
              <SpeedControl gameId={game.id} speed={speed} act={act} />
            </>
          ) : null}
          {nom.status === 'counted' ? (
            <>
              <p className="text-sm" role="status">
                计票完成：
                <b className="font-serif text-lg">{liveCount(nom, votes)}</b> 票 · 需 {nom.threshold} 票
              </p>
              <Button onClick={() => act(() => supabase.rpc('close_vote', { p_nomination: nom.id }))}>结束投票</Button>
            </>
          ) : null}
          {nom.status !== 'open' ? <VoteCorrections nom={nom} data={data} names={names} act={act} /> : null}
        </Panel>
      ) : null}

      <Panel className="flex flex-col gap-2" aria-label="今日提名">
        <h3 className="font-serif font-bold tracking-wider text-gold-strong">今日提名</h3>
        {today.length === 0 ? <p className="text-sm text-ink-faint">暂无</p> : null}
        <ol className="flex flex-col gap-1">
          {today.map((n) => (
            <li key={n.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {n.nominator_seat}号 → {n.nominee_seat}号 {names.get(n.nominee_seat)}
              </span>
              <span className="text-ink-muted">{n.status === 'closed' ? `${n.vote_count} 票 / 需 ${n.threshold}` : '进行中'}</span>
            </li>
          ))}
        </ol>
        {result ? (
          <p role="status" className="mt-1 text-sm font-medium">
            {result.executed_seat ? `今日处决：${result.executed_seat}号 ${names.get(result.executed_seat)}` : '今日无人处决'}
          </p>
        ) : !nom ? (
          <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
            <p className="text-sm" role="status">
              {block !== null ? `上处决台：${block}号 ${names.get(block)}` : '目前无人上处决台'}
            </p>
            <div className="flex gap-2">
              {block !== null ? (
                <Button
                  variant="danger"
                  className="flex-1"
                  onClick={() =>
                    act(() =>
                      supabase.rpc('conclude_day', {
                        p_game: game.id,
                        p_execute: true,
                      }),
                    )
                  }
                >
                  处决 {block}号
                </Button>
              ) : null}
              <Button
                variant="outline"
                className="flex-1"
                onClick={() =>
                  act(() =>
                    supabase.rpc('conclude_day', {
                      p_game: game.id,
                      p_execute: false,
                    }),
                  )
                }
              >
                无人处决
              </Button>
            </div>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

/** VOTE-05: 0.5–3 s per seat. */
function SpeedControl({ gameId, speed, act }: { gameId: string; speed: number; act: Act }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-ink-muted">
      <span>
        指针速度：每位 <b className="text-ink">{(speed / 1000).toFixed(speed % 500 === 0 ? 1 : 2)}</b> 秒
      </span>
      <input
        type="range"
        min={VOTE_SPEED.min}
        max={VOTE_SPEED.max}
        step={VOTE_SPEED.step}
        value={speed}
        aria-label="指针速度"
        onChange={(e) =>
          act(() =>
            supabase.rpc('set_vote_speed', {
              p_game: gameId,
              p_ms: Number(e.target.value),
            }),
          )
        }
        className="accent-[var(--color-gold)]"
      />
    </label>
  );
}

/** VOTE-08: before closing, the DM can flip any locked vote. */
function VoteCorrections({ nom, data, names, act }: { nom: Nomination; data: GameData; names: Map<number, string>; act: Act }) {
  const votes = votesOf(data, nom);
  const order = circleOrder(data.seats.length, nom.nominee_seat);
  const locked = order.filter((s) => votes.get(s)?.locked);
  if (locked.length === 0) return null;
  return (
    <details className="rounded-xl border border-line bg-surface-2 px-3 py-2">
      <summary className="min-h-9 cursor-pointer text-sm text-ink-muted">更正已锁定的票</summary>
      <ul className="mt-2 flex flex-col gap-1" aria-label="已锁定的票">
        {locked.map((s) => {
          const v = votes.get(s)!;
          return (
            <li key={s} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {s}号 {names.get(s)}
              </span>
              <Button
                variant={v.raised ? 'primary' : 'ghost'}
                aria-label={`更正 ${s}号 的票`}
                aria-pressed={v.raised}
                onClick={() =>
                  act(() =>
                    supabase.rpc('correct_vote', {
                      p_nomination: nom.id,
                      p_seat: s,
                      p_raised: !v.raised,
                    }),
                  )
                }
              >
                {v.raised ? '赞成' : '未举手'}
              </Button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function SeatSelect({
  label,
  value,
  onChange,
  seats,
  names,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  seats: number[];
  names: Map<number, string>;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-h-11 rounded-xl border border-line bg-surface-2 px-3 text-ink"
      >
        {seats.map((s) => (
          <option key={s} value={s}>
            {s}号 {names.get(s)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** END-01: the DM names the winning team. */
function EndGameDialog({ gameId, act, onClose }: { gameId: string; act: Act; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="结束游戏" description="选择获胜的阵营。结束后所有人会看到本局结算。">
      <div className="flex flex-col gap-3">
        <Button
          onClick={() => act(() => supabase.rpc('end_game', { p_game: gameId, p_winner: 'good' }), onClose)}
          className="bg-townsfolk text-white"
        >
          善良阵营获胜
        </Button>
        <Button onClick={() => act(() => supabase.rpc('end_game', { p_game: gameId, p_winner: 'evil' }), onClose)} className="bg-demon text-white">
          邪恶阵营获胜
        </Button>
        <Button variant="ghost" onClick={onClose}>
          取消
        </Button>
      </div>
    </Dialog>
  );
}

/** Every seat's actual and shown role and alignment (SECRET-02: the DM only). */
function SeatRoleList({ data, names }: { data: GameData; names: Map<number, string> }) {
  const roleById = new Map(data.roles.map((r) => [r.role_id, r]));
  const alive = new Map(data.seats.map((s) => [s.seat, s.alive]));
  return (
    <Panel aria-label="座位角色" padding="none">
      <ul>
        {data.seatRoles.map((sr) => {
          const actual = roleById.get(sr.actual_role_id)!;
          const shown = sr.shown_role_id !== sr.actual_role_id ? roleById.get(sr.shown_role_id) : undefined;
          return (
            <li
              key={sr.seat}
              data-testid={`dm-seat-${sr.seat}`}
              className="flex min-h-16 items-center gap-3 border-b border-line px-4 last:border-b-0"
            >
              <span className="w-8 font-serif font-bold text-gold-strong">{sr.seat}号</span>
              <RoleToken glyph={roleGlyph(actual)} team={actual.team} label={actual.name} size="sm" dead={alive.get(sr.seat) === false} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{names.get(sr.seat)}</span>
                <span className="block text-sm text-ink-muted">
                  {actual.name} · {ALIGNMENT_LABEL[sr.alignment]}
                </span>
              </span>
              {shown ? <Chip>展示：{shown.name}</Chip> : null}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
