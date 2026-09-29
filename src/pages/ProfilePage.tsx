import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Ornament } from '@/components/ui/Ornament';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import { TextField } from '@/components/ui/TextField';
import { ThemeScope } from '@/components/ui/ThemeScope';
import { useAuth } from '@/features/auth/useAuth';
import { UserMenu } from '@/features/auth/UserMenu';
import { roleGlyph } from '@/lib/game/composition';
import { computeStats, formatRate, type Stats } from '@/lib/game/stats';
import { ALIGNMENT_LABEL, type Team } from '@/lib/game/teams';
import type { Database } from '@/services/database.types';
import { errorMessage } from '@/services/errors';
import { supabase } from '@/services/supabase';
import { MessagePage } from './ComingSoon';

type HistoryRow = Database['public']['Functions']['profile_history']['Returns'][number];
type RoleInfo = { id: string; name: string; team: Team; glyph: string | null };

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; nickname: string; isGuest: boolean; stats: Stats | null; history: HistoryRow[]; roles: Map<string, RoleInfo> };

const dateOf = (iso: string) => iso.slice(0, 10);

/**
 * 个人主页 (HIST-01 / HIST-04): anyone's nickname and stats; the games in their history
 * that the viewer may open (HIST-02). On your own page you can rename yourself (AUTH-09).
 */
export function ProfilePage() {
  const { id = '' } = useParams();
  const { profile } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: p }, { data: rows }, { data: history }] = await Promise.all([
        supabase.from('profiles').select('nickname, is_guest').eq('id', id).maybeSingle(),
        supabase.rpc('profile_stat_rows', { p_user: id }),
        supabase.rpc('profile_history', { p_user: id }),
      ]);
      if (cancelled) return;
      if (!p) {
        setState({ status: 'missing' });
        return;
      }
      const games = (rows ?? []).map((r) => ({
        endedAt: r.ended_at,
        winner: r.winner,
        asDm: r.as_dm,
        startingRole: r.starting_role,
        finalAlignment: r.final_alignment,
      }));
      const stats = computeStats(games, p.is_guest);
      const ids = stats?.topRoles.map((t) => t.role) ?? [];
      const { data: roles } = ids.length ? await supabase.from('roles').select('id, name, team, glyph').in('id', ids) : { data: [] };
      if (cancelled) return;
      setState({
        status: 'ready',
        nickname: p.nickname ?? '',
        isGuest: p.is_guest,
        stats,
        history: history ?? [],
        roles: new Map((roles ?? []).map((r) => [r.id, r as RoleInfo])),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === 'loading') return <LoadingScreen label="正在载入主页…" />;
  if (state.status === 'missing') return <MessagePage title="用户不存在" message="没有找到这位用户，账号可能已被删除。" />;
  const { nickname, isGuest, stats, history, roles } = state;
  const mine = profile?.id === id;

  return (
    <ThemeScope theme="day" className="paper-grain min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col pb-12">
        <PageHeader>
          <UserMenu />
        </PageHeader>
        <header className="px-5 pt-2 text-center">
          <p className="text-xs tracking-[0.4em] text-ink-faint">{mine ? '我的主页' : '玩家主页'}</p>
          <h1 className="mt-1 font-serif text-4xl font-black tracking-[0.15em]">{nickname}</h1>
          {isGuest ? (
            <Chip className="mt-2">游客</Chip>
          ) : null}
          {mine ? (
            <div className="mt-2">
              <Button variant="ghost" onClick={() => setRenaming(true)}>
                修改昵称
              </Button>
            </div>
          ) : null}
          <Ornament className="mx-auto mt-4" />
        </header>

        {/* Remounted on every opening, so it starts from the current name with no leftover error. */}
        {mine ? (
          <RenameDialog
            key={renaming ? 'open' : 'closed'}
            open={renaming}
            onOpenChange={setRenaming}
            current={nickname}
            onRenamed={(name) => setState((st) => (st.status === 'ready' ? { ...st, nickname: name } : st))}
          />
        ) : null}

        <main className="mt-6 flex flex-col gap-5 px-4">
          {stats ? (
            <>
              <section aria-label="战绩" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="场次" value={String(stats.gamesPlayed)} testid="stat-games" />
                <Stat label="胜率" value={formatRate(stats.rate)} testid="stat-rate" big />
                <Stat label="善良胜率" value={formatRate(stats.byTeam.good.rate)} sub={`${stats.byTeam.good.wins}/${stats.byTeam.good.games}`} testid="stat-good" tone="good" />
                <Stat label="邪恶胜率" value={formatRate(stats.byTeam.evil.rate)} sub={`${stats.byTeam.evil.wins}/${stats.byTeam.evil.games}`} testid="stat-evil" tone="evil" />
              </section>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Panel aria-label="常玩角色">
                  <h2 className="font-serif text-base font-bold tracking-wider text-gold-strong">常玩角色</h2>
                  {stats.topRoles.length === 0 ? <p className="mt-2 text-sm text-ink-faint">还没有对局</p> : null}
                  <ol className="mt-3 flex flex-col gap-2" data-testid="top-roles">
                    {stats.topRoles.map((t) => {
                      const r = roles.get(t.role);
                      return (
                        <li key={t.role} className="flex items-center gap-3">
                          {r ? <RoleToken glyph={roleGlyph(r)} team={r.team} label={r.name} size="sm" /> : null}
                          <span className="flex-1 font-serif font-bold">{r?.name ?? t.role}</span>
                          <span className="text-sm text-ink-muted">{t.count} 局</span>
                        </li>
                      );
                    })}
                  </ol>
                </Panel>
                <Stat label="担任说书人" value={String(stats.gamesAsDm)} sub="局" testid="stat-dm" />
              </div>
            </>
          ) : (
            <Panel>
              <p className="text-sm text-ink-muted" role="status">
                游客不计入战绩。使用 Google 登录后，之前的对局也会计入。
              </p>
            </Panel>
          )}

          <Panel padding="none" aria-label="历史对局">
            <h2 className="px-4 pt-4 font-serif text-base font-bold tracking-wider text-gold-strong">历史对局</h2>
            {history.length === 0 ? <p className="px-4 pt-2 pb-4 text-sm text-ink-faint">暂无可查看的对局</p> : null}
            <ol className="mt-2">
              {history.map((h) => {
                const won = h.final_alignment !== null && h.final_alignment === h.winner;
                return (
                  <li key={h.game_id} className="border-t border-line" data-testid="history-row">
                    <Link to={`/games/${h.game_id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-ink/5">
                      <span className="w-24 shrink-0 text-sm text-ink-muted">{dateOf(h.ended_at)}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{h.script_name}</span>
                        <span className="truncate text-sm text-ink-muted">
                          {h.as_dm ? '说书人' : `${h.role_name ?? '—'} · ${h.final_alignment ? ALIGNMENT_LABEL[h.final_alignment] : ''}`}
                        </span>
                      </span>
                      {h.as_dm ? <Chip>说书人</Chip> : <Chip tone={won ? 'gold' : 'neutral'}>{won ? '胜' : '负'}</Chip>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </main>
      </div>
    </ThemeScope>
  );
}

function Stat({ label, value, sub, testid, big, tone }: { label: string; value: string; sub?: string; testid: string; big?: boolean; tone?: 'good' | 'evil' }) {
  return (
    <Panel className="flex flex-col items-center justify-center gap-1 text-center" data-testid={testid}>
      <span className="text-xs tracking-[0.2em] text-ink-faint">{label}</span>
      <span
        className={cn(
          'font-serif font-black leading-none',
          big ? 'text-4xl text-gold-strong' : 'text-3xl',
          tone === 'good' && 'text-townsfolk-text',
          tone === 'evil' && 'text-demon-text',
        )}
      >
        {value}
      </span>
      {sub ? <span className="text-xs text-ink-muted">{sub}</span> : null}
    </Panel>
  );
}

/** AUTH-09: rename yourself, under the same rules as the first nickname (AUTH-03). */
function RenameDialog({
  open,
  onOpenChange,
  current,
  onRenamed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: string;
  onRenamed: (name: string) => void;
}) {
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = name.trim();

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: nickError } = await supabase.rpc('set_nickname', { p_nickname: trimmed });
    setBusy(false);
    if (nickError) {
      setError(errorMessage(nickError));
      return;
    }
    await refreshProfile();
    onRenamed(trimmed);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="修改昵称" description="其他玩家会看到这个名字，过往对局中也会显示新昵称。" className="max-w-md">
      <form onSubmit={save} className="flex flex-col gap-4">
        <TextField label="新昵称" value={name} onChange={(e) => setName(e.target.value)} maxLength={12} autoFocus placeholder="1–12 个字符" error={error} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="submit" disabled={busy || trimmed.length === 0 || trimmed === current}>
            保存
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
