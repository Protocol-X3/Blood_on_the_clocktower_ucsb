import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { PageHeader } from '@/components/ui/PageHeader';
import { ThemeScope } from '@/components/ui/ThemeScope';
import { UserMenu } from '@/features/auth/UserMenu';
import { useAuth } from '@/features/auth/useAuth';
import type { Script } from '@/features/roles/data';
import { TEAM_LABEL, TEAMS } from '@/lib/game/teams';
import { supabase } from '@/services/supabase';

type ScriptWithRoles = Script & { script_roles: { roles: { team: (typeof TEAMS)[number] } | null }[] };

/** 剧本库: every signed-in user browses; DM-eligible users create (SCRIPT-01). */
export function ScriptsPage() {
  const { profile } = useAuth();
  const canEdit = profile && profile.permission !== 'player' && !profile.is_guest;
  const [scripts, setScripts] = useState<ScriptWithRoles[] | null>(null);

  useEffect(() => {
    supabase
      .from('scripts')
      .select('*, script_roles(roles(team))')
      .order('updated_at', { ascending: false })
      .then(({ data }) => setScripts((data ?? []) as ScriptWithRoles[]));
  }, []);

  return (
    <ThemeScope theme="day" className="paper-grain min-h-dvh">
      <div className="mx-auto max-w-3xl pb-12">
        <PageHeader>
          <UserMenu />
        </PageHeader>
        <div className="flex items-end justify-between gap-3 px-5 pt-2">
          <h1 className="font-serif text-3xl font-black tracking-[0.2em] text-gold-strong">剧本库</h1>
          {canEdit ? (
            <Button asChild variant="outline">
              <Link to="/scripts/new">新建剧本</Link>
            </Button>
          ) : null}
        </div>
        <ul className="mt-5 flex flex-col gap-3 px-4" aria-label="剧本">
          {scripts?.length === 0 ? <li className="px-1 text-sm text-ink-muted">还没有剧本。</li> : null}
          {scripts?.map((s) => (
            <li key={s.id}>
              <Link
                to={`/scripts/${s.id}`}
                className="flex min-h-16 flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-3 transition-colors hover:border-gold"
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-serif text-lg font-bold">{s.name}</span>
                  {s.author ? <span className="truncate text-sm text-ink-muted">{s.author}</span> : null}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {TEAMS.map((team) => {
                    const n = s.script_roles.filter((sr) => sr.roles?.team === team).length;
                    return n ? (
                      <Chip key={team} tone={team}>
                        {TEAM_LABEL[team]} {n}
                      </Chip>
                    ) : null;
                  })}
                  {s.special_rules ? <Chip tone="gold">特殊规则</Chip> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </ThemeScope>
  );
}
