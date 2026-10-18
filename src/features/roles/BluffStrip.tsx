import { cn } from '@/components/ui/cn';
import { RoleToken } from '@/components/ui/RoleToken';
import { roleGlyph } from '@/lib/game/composition';
import type { Team } from '@/lib/game/teams';

export interface BluffRole {
  name: string;
  team: Team;
  glyph?: string | null;
}

/** 不在场角色 (SETUP-12 / SECRET-07): a titled row of role tokens with their names. */
export function BluffStrip({ title, roles, className, testId }: { title: string; roles: BluffRole[]; className?: string; testId?: string }) {
  return (
    <section aria-label={title} data-testid={testId} className={cn('flex flex-col items-center gap-2', className)}>
      <p className="text-xs tracking-[0.3em] text-ink-faint">{title}</p>
      {roles.length ? (
        <ul className="flex flex-wrap justify-center gap-3">
          {roles.map((r) => (
            <li key={r.name} className="flex w-16 flex-col items-center gap-1 text-center">
              <RoleToken glyph={roleGlyph(r)} team={r.team} label={r.name} size="sm" />
              <span className="text-xs leading-tight text-ink">{r.name}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-faint">未选择</p>
      )}
    </section>
  );
}

/**
 * SECRET-07: the 不在场角色 for those allowed to see them all (the DM in game, everyone after
 * the end), with what the Lunatic sees when a 疯子 is in play. Nothing when none were picked.
 */
export function BluffPanel({
  bluffs,
  roles,
  lunatic,
}: {
  bluffs: { role_id: string; lunatic_role_id: string }[];
  roles: Map<string, BluffRole>;
  lunatic: boolean;
}) {
  if (bluffs.length === 0) return null;
  const pick = (ids: string[]) => ids.map((id) => roles.get(id)).filter((r): r is BluffRole => r !== undefined);
  return (
    <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 rounded-2xl border border-line bg-surface px-4 py-3" data-testid="bluff-panel">
      <BluffStrip title="不在场角色" roles={pick(bluffs.map((b) => b.role_id))} />
      {lunatic ? <BluffStrip title="疯子看到" roles={pick(bluffs.map((b) => b.lunatic_role_id))} /> : null}
    </div>
  );
}
