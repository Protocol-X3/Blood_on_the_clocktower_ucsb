import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/components/ui/cn';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import { groupByTeam } from '@/features/roles/data';
import { useGameData, type GameRole } from '@/features/game/useGameData';
import type { Member } from '@/features/room/useRoom';
import { checkComposition, countByTeam } from '@/lib/game/composition';
import { recommendedTeamCounts } from '@/lib/game/teamCounts';
import { TEAM_LABEL, TEAMS } from '@/lib/game/teams';
import { supabase, type Game } from '@/services/supabase';

type Act = (run: () => PromiseLike<{ error: unknown }>, after?: () => void) => Promise<void>;

/** The DM's setup wizard after "basics": composition, then assignment or draw, then start (SETUP-06). */
export function DmSetup({ game, members, act }: { game: Game; members: Member[]; act: Act }) {
  const { data, reload } = useGameData(game.id);
  const [editing, setEditing] = useState(false);
  if (!data) return null;
  const seatCount = game.seat_count ?? 0;
  const compositionDone = data.composition.length === seatCount;
  const step = !compositionDone || editing ? 'composition' : 'assign';
  const run: Act = async (fn, after) => {
    await act(fn, after);
    await reload();
  };

  return (
    <div className="flex flex-col gap-5" data-testid="setup-wizard">
      <ol className="flex items-center gap-2 text-sm" aria-label="配置步骤">
        {['基础设置', '角色配置', game.assignment_mode === 'draw' ? '抽卡' : '分配角色', '开始游戏'].map((label, i) => {
          const current = (step === 'composition' ? 1 : 2) === i;
          const done = i === 0 || (i === 1 && step === 'assign');
          return (
            <li key={label} className="flex items-center gap-2" aria-current={current ? 'step' : undefined}>
              <span
                className={cn(
                  'grid size-7 place-items-center rounded-full border font-serif text-xs font-bold',
                  current ? 'border-gold bg-gold text-gold-ink' : done ? 'border-gold text-gold-strong' : 'border-line text-ink-faint',
                )}
              >
                {i + 1}
              </span>
              <span className={cn(current ? 'font-bold text-ink' : 'text-ink-muted', 'hidden sm:inline')}>{label}</span>
              {i < 3 ? <span className="h-px w-4 bg-line sm:w-8" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>

      {step === 'composition' ? (
        <CompositionStep
          game={game}
          roles={data.roles}
          initial={data.composition.map((c) => ({ role: c.role_id, shown: c.shown_role_id }))}
          onBack={() => (compositionDone ? setEditing(false) : run(() => supabase.rpc('cancel_setup', { p_game: game.id })))}
          backLabel={compositionDone ? '取消修改' : '返回基础设置'}
          onSave={(entries) =>
            run(() => supabase.rpc('set_composition', { p_game: game.id, p_roles: entries }), () => setEditing(false))
          }
        />
      ) : (
        <AssignStep game={game} data={data} members={members} run={run} onEditComposition={() => setEditing(true)} />
      )}
    </div>
  );
}

function CompositionStep({
  game,
  roles,
  initial,
  onSave,
  onBack,
  backLabel,
}: {
  game: Game;
  roles: GameRole[];
  initial: { role: string; shown: string }[];
  onSave: (entries: { role: string; shown: string }[]) => void;
  onBack: () => void;
  backLabel: string;
}) {
  const seatCount = game.seat_count ?? 0;
  const [entries, setEntries] = useState(initial);
  const byId = useMemo(() => new Map(roles.map((r) => [r.role_id, r])), [roles]);
  const scriptRoles = useMemo(() => roles.map((r) => ({ id: r.role_id, name: r.name, team: r.team, glyph: r.glyph })), [roles]);
  const check = checkComposition(seatCount, entries, scriptRoles);
  const recommended = recommendedTeamCounts(seatCount);
  const counts = countByTeam(entries.map((e) => byId.get(e.role)).filter((r): r is GameRole => r !== undefined));
  const toggle = (id: string) =>
    setEntries((es) => (es.some((e) => e.role === id) ? es.filter((e) => e.role !== id) : [...es, { role: id, shown: id }]));
  const missing = seatCount - entries.length;

  return (
    <>
      <Panel className="flex flex-col gap-3" aria-label="阵营人数">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-lg font-bold tracking-wider text-gold-strong">角色配置 · {seatCount} 人</h2>
          <span className={cn('text-sm', missing === 0 ? 'text-ink-muted' : 'font-bold text-blood-text')} data-testid="composition-count">
            {missing > 0 ? `还需选择 ${missing} 个角色` : missing < 0 ? `多选了 ${-missing} 个角色` : '人数已齐'}
          </span>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TEAMS.map((t) => {
            const off = check.offRecommendation.find((o) => o.team === t);
            return (
              <li key={t} className={cn('rounded-xl border px-3 py-2', off && missing === 0 ? 'border-minion/60 bg-minion/10' : 'border-line bg-surface-2')}>
                <p className="text-xs text-ink-muted">{TEAM_LABEL[t]}</p>
                <p className="font-serif text-xl font-bold">
                  {counts[t]}
                  <span className="text-sm font-normal text-ink-faint"> / 建议 {recommended?.[t] ?? '—'}</span>
                </p>
              </li>
            );
          })}
        </ul>
        {missing === 0 && check.offRecommendation.length > 0 ? (
          <p className="text-sm text-minion-text" role="status">
            与建议的阵营人数不同（例如男爵等角色会改变人数）。仍可继续。
          </p>
        ) : null}
      </Panel>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        <Panel aria-label="剧本角色">
          <h3 className="font-serif text-base font-bold tracking-wider text-gold-strong">剧本角色</h3>
          {groupByTeam(roles).map((g) => (
            <div key={g.team} className="mt-3">
              <p className="text-xs tracking-[0.2em] text-ink-faint">{TEAM_LABEL[g.team]}</p>
              <ul className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {g.roles.map((r) => {
                  const on = entries.some((e) => e.role === r.role_id);
                  return (
                    <li key={r.role_id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        aria-label={r.name}
                        onClick={() => toggle(r.role_id)}
                        className={cn(
                          'flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs transition-colors',
                          on ? 'border-gold bg-gold/15' : 'border-transparent hover:border-line',
                        )}
                      >
                        <RoleToken glyph={r.glyph} team={r.team} label={r.name} size="sm" />
                        <span className="leading-tight">{r.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </Panel>

        <Panel aria-label="本局角色">
          <h3 className="font-serif text-base font-bold tracking-wider text-gold-strong">本局角色 · {entries.length}</h3>
          <p className="mt-1 text-xs text-ink-muted">“展示为”是玩家看到的角色，例如让酒鬼看到一个镇民。</p>
          <ul className="mt-3 flex flex-col gap-2">
            {entries.map((e) => {
              const r = byId.get(e.role);
              if (!r) return null;
              return (
                <li key={e.role} className="flex items-center gap-3">
                  <RoleToken glyph={r.glyph} team={r.team} label={r.name} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                  <label className="flex items-center gap-2 text-xs text-ink-muted">
                    展示为
                    <select
                      aria-label={`${r.name} 展示为`}
                      value={e.shown}
                      onChange={(ev) => setEntries((es) => es.map((x) => (x.role === e.role ? { ...x, shown: ev.target.value } : x)))}
                      className="min-h-11 rounded-lg border border-line bg-surface-2 px-2 text-sm text-ink"
                    >
                      {roles.map((o) => (
                        <option key={o.role_id} value={o.role_id}>
                          {o.role_id === e.role ? `${o.name}（本身）` : o.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onBack}>
          {backLabel}
        </Button>
        <Button disabled={check.errors.length > 0} onClick={() => onSave(entries)}>
          下一步
        </Button>
      </div>
    </>
  );
}

function AssignStep({
  game,
  data,
  members,
  run,
  onEditComposition,
}: {
  game: Game;
  data: NonNullable<ReturnType<typeof useGameData>['data']>;
  members: Member[];
  run: Act;
  onEditComposition: () => void;
}) {
  const seatCount = game.seat_count ?? 0;
  const seats = Array.from({ length: seatCount }, (_, i) => i + 1);
  const bySeat = new Map(members.filter((m) => m.seat).map((m) => [m.seat!, m]));
  const roleById = new Map(data.roles.map((r) => [r.role_id, r]));
  const assigned = new Map(data.seatRoles.map((s) => [s.seat, s]));
  const allSeated = seats.every((s) => bySeat.has(s));
  const ready = allSeated && seats.every((s) => assigned.has(s));
  const draw = game.assignment_mode === 'draw';

  return (
    <>
      <Panel aria-label={draw ? '抽卡' : '分配角色'} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-bold tracking-wider text-gold-strong">{draw ? '抽卡' : '分配角色'}</h2>
          {draw ? (
            <Button variant={data.slots.length ? 'outline' : 'primary'} onClick={() => run(() => supabase.rpc('shuffle_cards', { p_game: game.id }))}>
              {data.slots.length ? '重新洗牌' : '发牌'}
            </Button>
          ) : null}
        </div>
        {draw && data.slots.length === 0 ? <p className="text-sm text-ink-muted">发牌后，玩家可以在手机上抽取自己的角色。</p> : null}
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="座位角色">
          {seats.map((seat) => {
            const member = bySeat.get(seat);
            const sr = assigned.get(seat);
            const actual = sr ? roleById.get(sr.actual_role_id) : undefined;
            const shown = sr && sr.shown_role_id !== sr.actual_role_id ? roleById.get(sr.shown_role_id) : undefined;
            return (
              <li key={seat} data-testid={`assign-seat-${seat}`} className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2">
                <span className="w-8 font-serif font-bold text-gold-strong">{seat}号</span>
                <span className={cn('min-w-0 flex-1 truncate', member ? 'text-ink' : 'text-ink-faint')}>{member?.profile?.nickname ?? '空座'}</span>
                {draw ? (
                  actual ? (
                    <span className="flex items-center gap-2">
                      <RoleToken glyph={actual.glyph} team={actual.team} label={actual.name} size="sm" />
                      <span className="text-sm">{actual.name}</span>
                      {shown ? <Chip>展示：{shown.name}</Chip> : null}
                    </span>
                  ) : (
                    <span className="text-sm text-ink-faint">未抽卡</span>
                  )
                ) : (
                  <select
                    aria-label={`${seat}号的角色`}
                    disabled={!member}
                    value={sr?.actual_role_id ?? ''}
                    onChange={(e) =>
                      run(() =>
                        e.target.value
                          ? supabase.rpc('assign_seat', { p_game: game.id, p_seat: seat, p_role: e.target.value })
                          : supabase.rpc('unassign_seat', { p_game: game.id, p_seat: seat }),
                      )
                    }
                    className="min-h-11 max-w-44 rounded-lg border border-line bg-surface px-2 text-sm text-ink disabled:opacity-50"
                  >
                    <option value="">选择角色</option>
                    {data.composition.map((c) => {
                      const r = roleById.get(c.role_id)!;
                      const taken = data.seatRoles.some((s) => s.actual_role_id === c.role_id && s.seat !== seat);
                      return (
                        <option key={c.role_id} value={c.role_id} disabled={taken}>
                          {r.name}
                          {c.shown_role_id !== c.role_id ? `（展示：${roleById.get(c.shown_role_id)?.name}）` : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </li>
            );
          })}
        </ul>
        {!allSeated ? <p className="text-sm text-blood-text">还有座位没有玩家。请返回大厅让玩家入座。</p> : null}
      </Panel>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onEditComposition}>
          修改角色配置
        </Button>
        <Button size="lg" className="w-auto" disabled={!ready} onClick={() => run(() => supabase.rpc('start_game', { p_game: game.id }))}>
          开始游戏
        </Button>
      </div>
    </>
  );
}

