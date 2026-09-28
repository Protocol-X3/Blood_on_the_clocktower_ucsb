import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Ornament } from '@/components/ui/Ornament';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { ThemeScope } from '@/components/ui/ThemeScope';
import { UserMenu } from '@/features/auth/UserMenu';
import { useAuth } from '@/features/auth/useAuth';
import { groupByTeam, type Role, type Script } from '@/features/roles/data';
import { RoleRow } from '@/features/roles/RoleCard';
import { TEAM_LABEL } from '@/lib/game/teams';
import { supabase } from '@/services/supabase';
import { MessagePage } from './ComingSoon';

/** 剧本详情: the script's roles grouped by team (SCRIPT-05). */
export function ScriptDetailPage() {
  const { id = '' } = useParams();
  const { profile } = useAuth();
  const canEdit = profile && profile.permission !== 'player' && !profile.is_guest;
  const [state, setState] = useState<{ script: Script; roles: Role[] } | 'missing' | null>(null);

  useEffect(() => {
    supabase
      .from('scripts')
      .select('*, script_roles(position, roles(*))')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return setState('missing');
        const rows = (data.script_roles as unknown as { position: number; roles: Role }[]).sort((a, b) => a.position - b.position);
        setState({ script: data as Script, roles: rows.map((r) => r.roles) });
      });
  }, [id]);

  if (state === null) return <LoadingScreen />;
  if (state === 'missing') return <MessagePage title="剧本不存在" message="没有找到这个剧本。" theme="day" />;

  return (
    <ThemeScope theme="day" className="paper-grain min-h-dvh">
      <div className="mx-auto max-w-3xl pb-12">
        <PageHeader back="/scripts" backLabel="剧本库">
          <UserMenu />
        </PageHeader>
        <header className="flex flex-col items-center px-5 pt-2 text-center">
          <h1 className="font-serif text-3xl font-black tracking-[0.2em] text-gold-strong">{state.script.name}</h1>
          {state.script.author ? <p className="mt-1 text-sm text-ink-muted">{state.script.author}</p> : null}
          <Ornament className="mt-4" />
          {canEdit ? (
            <Button asChild variant="outline" className="mt-4">
              <Link to={`/scripts/${id}/edit`}>编辑剧本</Link>
            </Button>
          ) : null}
        </header>
        <div className="mt-6 flex flex-col gap-5 px-4">
          {groupByTeam(state.roles).map((group) => (
            <Panel key={group.team} aria-label={TEAM_LABEL[group.team]}>
              <h2 className="font-serif text-lg font-bold tracking-wider text-gold-strong">
                {TEAM_LABEL[group.team]} · {group.roles.length}
              </h2>
              <ul className="mt-3 flex flex-col gap-4">
                {group.roles.map((r) => (
                  <li key={r.id}>
                    <RoleRow role={r} />
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      </div>
    </ThemeScope>
  );
}
