import { Chip } from '@/components/ui/Chip';
import { cn } from '@/components/ui/cn';
import { Ornament } from '@/components/ui/Ornament';
import { Panel } from '@/components/ui/Panel';
import { RoleToken } from '@/components/ui/RoleToken';
import { roleGlyph } from '@/lib/game/composition';
import { ALIGNMENT_LABEL, defaultAlignment, TEAM_LABEL, type Team } from '@/lib/game/teams';

export interface RoleInfo {
  id?: string;
  name: string;
  team: Team;
  ability: string;
  glyph?: string | null;
}

/** The gilded role card a player sees for their (shown) role. */
export function RoleCard({ role, className }: { role: RoleInfo; className?: string }) {
  return (
    <Panel variant="gilded" padding="lg" className={cn('mx-auto flex w-full max-w-80 flex-col items-center text-center', className)} data-testid="role-card">
      <RoleToken glyph={roleGlyph(role)} team={role.team} label={role.name} size="xl" />
      <h2 className="mt-5 font-serif text-3xl font-black tracking-[0.2em]">{role.name}</h2>
      <span className="mt-2 rounded-full border border-[#2f62a8]/30 bg-[#fbf6ea] px-3 py-0.5 text-xs font-medium text-[#3f3325]">
        {TEAM_LABEL[role.team]} · {ALIGNMENT_LABEL[defaultAlignment(role.team)]}阵营
      </span>
      <Ornament className="mt-4" />
      <p className="mt-3 text-sm leading-7 text-[#3f3325]">{role.ability}</p>
    </Panel>
  );
}

/** A compact row: token, name, team chip and (optionally) the ability. */
export function RoleRow({ role, showAbility = true, children }: { role: RoleInfo; showAbility?: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <RoleToken glyph={roleGlyph(role)} team={role.team} label={role.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-serif font-bold">{role.name}</span>
          <Chip tone={role.team}>{TEAM_LABEL[role.team]}</Chip>
        </div>
        {showAbility ? <p className="mt-1 text-sm leading-relaxed text-ink-muted">{role.ability}</p> : null}
      </div>
      {children}
    </div>
  );
}
