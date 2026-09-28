import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/components/ui/cn';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import type { GameData } from '@/features/game/useGameData';
import { RoleCard } from '@/features/roles/RoleCard';
import { roleGlyph } from '@/lib/game/composition';
import { TEAM_LABEL } from '@/lib/game/teams';
import { canRaiseHand, voteThreshold } from '@/lib/game/vote';
import { supabase, type Game } from '@/services/supabase';
import { Board } from './Board';
import { blockToday, circleSeats, deathText, liveCount, openNomination, votesOf, type DeathCause } from './model';
import { SeatCircle } from './SeatCircle';
import { useWidth } from './useWidth';

type Act = (run: () => PromiseLike<{ error: unknown }>, after?: () => void) => Promise<void>;

/**
 * A player's live game (phone first): their role, the town square with the vote
 * clock, the nomination with the 举手 button, who died and why, and the board.
 */
export function PlayerLive({
  game,
  data,
  me,
  mySeat,
  names,
  act,
}: {
  game: Game;
  data: GameData;
  me: string;
  mySeat: number | null;
  names: Map<number, string>;
  act: Act;
}) {
  const night = game.phase_kind !== 'day';
  const [showRole, setShowRole] = useState(false);
  const mine = data.shown[0];
  const role = mine ? data.roles.find((r) => r.role_id === mine.shown_role_id) : undefined;
  const seat = data.seats.find((s) => s.seat === mySeat);
  const nom = openNomination(data);
  const votes = votesOf(data, nom);
  const myVote = mySeat ? votes.get(mySeat) : undefined;
  const living = data.seats.filter((s) => s.alive).length;
  const day = game.phase_number ?? 1;
  const block = blockToday(data, day);
  const result = data.dayResults.find((d) => d.day_number === day);
  const [circleRef, circleWidth] = useWidth<HTMLDivElement>(300);

  return (
    <div className="flex flex-col gap-5">
      {/* The role: a full card at night, a compact bar by day that expands on tap. */}
      {role && (night || showRole) ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-full motion-safe:animate-flip-in">
            <RoleCard role={role} />
          </div>
          {!night ? (
            <Button variant="ghost" onClick={() => setShowRole(false)}>
              收起角色
            </Button>
          ) : null}
        </div>
      ) : role ? (
        <button
          type="button"
          onClick={() => setShowRole(true)}
          aria-expanded="false"
          className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2 text-left"
        >
          <RoleToken glyph={roleGlyph(role)} team={role.team} label={role.name} size="sm" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs text-ink-faint">我的角色 · {mySeat}号</span>
            <span className="font-serif text-[17px] font-bold">{role.name}</span>
          </span>
          <Chip tone={role.team}>{TEAM_LABEL[role.team]}</Chip>
        </button>
      ) : (
        <p className="text-center text-sm text-ink-muted" role="status">
          对局进行中，你正在旁观。
        </p>
      )}

      {seat && !seat.alive ? (
        <p role="status" className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-center text-sm text-ink-muted">
          你已死亡（{deathText(seat.death_cause as DeathCause, seat.death_note)}
          ）· {seat.ghost_vote_used ? '幽灵票已用' : '还有一张幽灵票'}
        </p>
      ) : null}

      {/* The town square and the vote. */}
      <Panel className="flex flex-col items-center gap-4" aria-label="城镇广场">
        <NominationHeader data={data} names={names} night={night} />
        <div ref={circleRef} className="w-full">
          <SeatCircle
            label="座位"
            size={Math.min(300, circleWidth)}
            seats={circleSeats(data, names, { mySeat })}
            sweep={
              nom && nom.status !== 'open'
                ? {
                    from: (nom.nominee_seat % data.seats.length) + 1,
                    passed: nom.hand_index,
                  }
                : null
            }
            center={
              nom && nom.status !== 'open' ? (
                <div className="flex flex-col items-center" data-testid="vote-tally">
                  <span className="font-serif text-4xl font-black leading-none">{liveCount(nom, votes)}</span>
                  <span className="mt-1 text-xs text-ink-muted">需 {nom.threshold ?? voteThreshold(living)} 票</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="font-serif text-3xl font-black leading-none">{living}</span>
                  <span className="mt-1 text-xs text-ink-muted">存活</span>
                </div>
              )
            }
          />
        </div>
        {nom && (nom.status === 'open' || nom.status === 'voting') && seat ? (
          myVote?.locked ? (
            <p className="text-sm text-ink-muted" role="status">
              你的票已锁定：{myVote.raised ? '赞成' : '未举手'}
            </p>
          ) : !canRaiseHand({
              alive: seat.alive,
              ghostVoteUsed: seat.ghost_vote_used,
            }) ? (
            <p className="text-sm text-ink-muted" role="status">
              你的幽灵票已用完，不能举手
            </p>
          ) : (
            <Button
              size="lg"
              variant={myVote?.raised ? 'primary' : 'outline'}
              aria-pressed={!!myVote?.raised}
              onClick={() =>
                act(() =>
                  supabase.rpc('set_hand', {
                    p_nomination: nom.id,
                    p_raised: !myVote?.raised,
                  }),
                )
              }
            >
              {myVote?.raised ? '已举手 · 轻触放下' : '举手'}
            </Button>
          )
        ) : null}
        {!nom && block !== null && !result ? (
          <p role="status" className="text-sm font-medium text-blood-text">
            上处决台：{block}号 {names.get(block)}
          </p>
        ) : null}
        {result ? (
          <p role="status" className="text-sm font-medium text-ink-muted">
            {result.executed_seat ? `今日处决：${result.executed_seat}号 ${names.get(result.executed_seat)}` : '今日无人处决'}
          </p>
        ) : null}
      </Panel>

      <TownList data={data} names={names} mySeat={mySeat} />

      <Board posts={data.posts} names={names} me={me} isDm={false} canPost={!!seat} act={act} gameId={game.id} />
    </div>
  );
}

function NominationHeader({ data, names, night }: { data: GameData; names: Map<number, string>; night: boolean }) {
  const nom = openNomination(data);
  if (!nom) {
    return (
      <p className="text-sm text-ink-muted" data-testid="nomination-status">
        {night ? '夜幕降临，请闭眼' : '等待提名'}
      </p>
    );
  }
  const status = {
    open: '提名中 · 可举手',
    voting: '计票中',
    counted: '计票完成',
  }[nom.status as 'open' | 'voting' | 'counted'];
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-2" data-testid="nomination-status">
      <span
        className={cn('flex items-center gap-1.5 text-xs font-bold tracking-wider', nom.status === 'voting' ? 'text-blood-text' : 'text-gold-strong')}
      >
        <span aria-hidden="true" className={cn('size-2 rounded-full', nom.status === 'voting' ? 'bg-blood' : 'bg-gold')} />
        {status}
      </span>
      <span className="text-sm text-ink-muted">
        {nom.nominator_seat}号 {names.get(nom.nominator_seat)} 提名{' '}
        <b className="text-blood-text">
          {nom.nominee_seat}号 {names.get(nom.nominee_seat)}
        </b>
      </span>
    </div>
  );
}

/** DEATH-01 / DEATH-03: everyone sees who is alive, who died and why, and ghost votes. */
export function TownList({ data, names, mySeat }: { data: GameData; names: Map<number, string>; mySeat?: number | null }) {
  return (
    <Panel padding="none" aria-label="城镇">
      <ul>
        {data.seats.map((s) => (
          <li
            key={s.seat}
            data-testid={`town-seat-${s.seat}`}
            className={cn('flex min-h-12 items-center gap-3 border-b border-line px-4 last:border-b-0', !s.alive && 'text-ink-faint')}
          >
            <span className={cn('w-8 font-serif font-bold', s.alive ? 'text-gold-strong' : 'text-ink-faint')}>{s.seat}号</span>
            <span className={cn('min-w-0 flex-1 truncate', s.seat === mySeat && 'font-bold')}>{names.get(s.seat)}</span>
            {s.alive ? (
              <span className="text-xs text-ink-faint">存活</span>
            ) : (
              <span className="flex items-center gap-2 text-xs">
                <span
                  aria-hidden="true"
                  className="grid size-5 place-items-center rounded-full bg-parchment-ink font-serif text-[10px] font-bold text-parchment"
                >
                  亡
                </span>
                <span>{deathText(s.death_cause as DeathCause, s.death_note)}</span>
                <span>· {s.ghost_vote_used ? '票已用' : '有幽灵票'}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
