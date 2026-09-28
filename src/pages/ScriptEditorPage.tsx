import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import { TextField } from '@/components/ui/TextField';
import { ThemeScope } from '@/components/ui/ThemeScope';
import { UserMenu } from '@/features/auth/UserMenu';
import { useAuth } from '@/features/auth/useAuth';
import { EDITION_LABEL, groupByTeam, type Role } from '@/features/roles/data';
import { roleGlyph } from '@/lib/game/composition';
import { TEAM_LABEL, TEAMS, type Team } from '@/lib/game/teams';
import { errorMessage } from '@/services/errors';
import { supabase } from '@/services/supabase';
import { MessagePage } from './ComingSoon';

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'tb', label: EDITION_LABEL.tb },
  { key: 'bmr', label: EDITION_LABEL.bmr },
  { key: 'snv', label: EDITION_LABEL.snv },
  { key: 'exp', label: EDITION_LABEL.exp },
  { key: 'hdcs', label: EDITION_LABEL.hdcs },
  { key: 'custom', label: '自定义' },
] as const;

/** Create (`/scripts/new`) or edit (`/scripts/:id/edit`) a script (SCRIPT-01..04). */
export function ScriptEditorPage() {
  const { profile } = useAuth();
  if (!profile || profile.permission === 'player' || profile.is_guest) {
    return <MessagePage title="没有权限" message="只有可担任说书人的玩家可以编辑剧本。" theme="day" />;
  }
  return <Editor />;
}

function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [library, setLibrary] = useState<Role[] | null>(null);
  const [name, setName] = useState('');
  const [author, setAuthor] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('tb');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('roles').select('*').order('is_official', { ascending: false }).order('name'),
      id ? supabase.from('scripts').select('*, script_roles(role_id, position)').eq('id', id).maybeSingle() : Promise.resolve({ data: null }),
    ]).then(([roles, script]) => {
      setLibrary(roles.data ?? []);
      if (script.data) {
        const s = script.data as { name: string; author: string | null; script_roles: { role_id: string; position: number }[] };
        setName(s.name);
        setAuthor(s.author ?? '');
        setSelected([...s.script_roles].sort((a, b) => a.position - b.position).map((r) => r.role_id));
      }
    });
  }, [id]);

  const byId = useMemo(() => new Map((library ?? []).map((r) => [r.id, r])), [library]);
  const visible = useMemo(() => {
    const q = query.trim();
    return (library ?? []).filter(
      (r) =>
        (filter === 'all' || (filter === 'custom' ? !r.is_official : r.edition === filter)) &&
        (!q || r.name.includes(q) || r.ability.includes(q)),
    );
  }, [library, filter, query]);

  if (!library) return <LoadingScreen />;

  const toggle = (roleId: string) =>
    setSelected((s) => (s.includes(roleId) ? s.filter((x) => x !== roleId) : [...s, roleId]));

  async function save() {
    setSaving(true);
    setError(null);
    const { data, error: saveError } = await supabase.rpc('save_script', {
      p_script: (id ?? null) as unknown as string,
      p_name: name,
      p_author: author,
      p_roles: selected,
    });
    setSaving(false);
    if (saveError) setError(errorMessage(saveError));
    else navigate(`/scripts/${data}`);
  }

  const selectedRoles = selected.map((r) => byId.get(r)).filter((r): r is Role => r !== undefined);

  return (
    <ThemeScope theme="day" className="paper-grain min-h-dvh">
      <div className="mx-auto max-w-5xl md:pb-28">
        <PageHeader back={id ? `/scripts/${id}` : '/scripts'} backLabel="返回">
          <UserMenu />
        </PageHeader>
        <h1 className="px-5 pt-2 font-serif text-3xl font-black tracking-[0.2em] text-gold-strong">{id ? '编辑剧本' : '新建剧本'}</h1>

        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 px-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <Panel className="flex flex-col gap-3">
              <TextField label="剧本名称" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="例如：暗流涌动" />
              <TextField label="作者（可选）" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={30} />
            </Panel>
            <Panel aria-label="已选角色">
              <h2 className="font-serif text-lg font-bold tracking-wider text-gold-strong">已选角色 · {selected.length}</h2>
              {selected.length === 0 ? <p className="mt-2 text-sm text-ink-muted">从右侧角色库中加入角色。</p> : null}
              {groupByTeam(selectedRoles).map((g) => (
                <div key={g.team} className="mt-3">
                  <p className="text-xs tracking-[0.2em] text-ink-faint">{TEAM_LABEL[g.team]} · {g.roles.length}</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {g.roles.map((r) => (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => toggle(r.id)}
                          aria-label={`移除 ${r.name}`}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-3 text-sm hover:border-blood"
                        >
                          <RoleToken glyph={roleGlyph(r)} team={r.team} label={r.name} size="sm" className="size-8 text-sm" />
                          {r.name}
                          <span aria-hidden="true" className="text-ink-faint">×</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Panel>
          </div>

          <Panel aria-label="角色库" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif text-lg font-bold tracking-wider text-gold-strong">角色库</h2>
              <Button variant="outline" onClick={() => setCreating(true)}>
                新建自定义角色
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="筛选">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'min-h-11 rounded-full border px-3 text-sm',
                    filter === f.key ? 'border-gold bg-gold/15 font-bold text-gold-strong' : 'border-line text-ink-muted hover:border-gold',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              aria-label="搜索角色"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索角色名或能力"
              className="min-h-11 rounded-xl border border-line bg-surface-2 px-4 text-ink placeholder:text-ink-faint/70 focus:border-gold focus:outline-none"
            />
            <ul className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto pr-1">
              {visible.map((r) => {
                const on = selected.includes(r.id);
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      aria-pressed={on}
                      aria-label={r.name}
                      className={cn(
                        'flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left transition-colors',
                        on ? 'bg-gold/15' : 'hover:bg-surface-2',
                      )}
                    >
                      <RoleToken glyph={roleGlyph(r)} team={r.team} label={r.name} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-serif font-bold">{r.name}</span>
                        <span className="block truncate text-xs text-ink-muted">{r.ability}</span>
                      </span>
                      <span className={cn('text-sm', on ? 'font-bold text-gold-strong' : 'text-ink-faint')}>{on ? '已加入' : '加入'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>

      {/* Floating on tablets and laptops; at the end of the page on phones, where it would cover the list. */}
      <div className="z-20 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur md:fixed md:inset-x-0 md:bottom-0">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          {error ? (
            <p role="alert" className="min-w-0 flex-1 text-sm text-blood-text">
              {error}
            </p>
          ) : (
            <p className="min-w-0 flex-1 text-sm text-ink-muted">共 {selected.length} 个角色</p>
          )}
          <Button onClick={save} disabled={saving}>
            保存剧本
          </Button>
        </div>
      </div>

      <CustomRoleDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(role) => {
          setLibrary((l) => [...(l ?? []), role]);
          setSelected((s) => [...s, role.id]);
          setFilter('custom');
        }}
      />
    </ThemeScope>
  );
}

/** SCRIPT-03 / SCRIPT-04: a custom role, saved into the library for reuse. */
function CustomRoleDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (r: Role) => void }) {
  const [name, setName] = useState('');
  const [team, setTeam] = useState<Team>('townsfolk');
  const [glyph, setGlyph] = useState('');
  const [ability, setAbility] = useState('');
  const [reminders, setReminders] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const tokens = reminders.split(/[,，、\s]+/).map((t) => t.trim()).filter(Boolean);
    const { data, error: createError } = await supabase.rpc('create_custom_role', {
      p_name: name,
      p_team: team,
      p_ability: ability,
      p_glyph: glyph,
      p_reminders: tokens,
    });
    if (createError) return setError(errorMessage(createError));
    const { data: role } = await supabase.from('roles').select('*').eq('id', data).single();
    if (role) onCreated(role);
    setName('');
    setGlyph('');
    setAbility('');
    setReminders('');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="新建自定义角色" description="保存后会加入角色库，其他剧本也可以使用。" className="max-w-md">
      <form onSubmit={create} className="flex flex-col gap-3">
        <TextField label="角色名称" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} required />
        <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
          阵营
          <select value={team} onChange={(e) => setTeam(e.target.value as Team)} className="min-h-12 rounded-xl border border-line bg-surface-2 px-3 text-ink">
            {TEAMS.map((t) => (
              <option key={t} value={t}>
                {TEAM_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <TextField label="图标字（可选，1 个字）" value={glyph} onChange={(e) => setGlyph(e.target.value)} maxLength={1} />
        <label className="flex flex-col gap-1.5 text-sm text-ink-muted">
          能力
          <textarea
            value={ability}
            onChange={(e) => setAbility(e.target.value)}
            maxLength={300}
            rows={3}
            required
            className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-ink focus:border-gold focus:outline-none"
          />
        </label>
        <TextField label="提示标记（可选，用逗号分隔）" value={reminders} onChange={(e) => setReminders(e.target.value)} />
        {error ? (
          <p role="alert" className="text-sm text-blood-text">
            {error}
          </p>
        ) : null}
        <Button type="submit">创建角色</Button>
      </form>
    </Dialog>
  );
}
