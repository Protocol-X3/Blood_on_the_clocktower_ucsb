import { recommendedTeamCounts, type TeamCounts } from './teamCounts';
import { TEAMS, type Team } from './teams';

export interface RoleLike {
  id: string;
  name: string;
  team: Team;
  glyph?: string | null;
}

/** LIB-03: the one-character token glyph: the role's override, or the first character of its name. */
export function roleGlyph(role: Pick<RoleLike, 'name' | 'glyph'>): string {
  const override = role.glyph?.trim();
  return override ? [...override][0]! : ([...role.name.trim()][0] ?? '?');
}

/** How many roles of each team. */
export function countByTeam(roles: Pick<RoleLike, 'team'>[]): TeamCounts {
  const counts: TeamCounts = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 };
  for (const r of roles) counts[r.team] += 1;
  return counts;
}

export interface CompositionEntry {
  role: string;
  /** The role the player will be shown; defaults to `role` (SETUP-08). */
  shown?: string;
}

export type CompositionError = 'size' | 'duplicate' | 'not_in_script';

export interface CompositionCheck {
  /** SETUP-07: problems that block the composition. */
  errors: CompositionError[];
  /** SETUP-07: teams whose count differs from the recommendation (a warning only). */
  offRecommendation: { team: Team; actual: number; recommended: number }[];
}

/**
 * SETUP-07 / SETUP-08: checks a composition against the seat count and the
 * script. Size, duplicates and unknown roles are errors; team counts that differ
 * from the official recommendation are only warnings.
 */
export function checkComposition(seatCount: number, entries: CompositionEntry[], scriptRoles: RoleLike[]): CompositionCheck {
  const byId = new Map(scriptRoles.map((r) => [r.id, r]));
  const errors: CompositionError[] = [];
  if (entries.length !== seatCount) errors.push('size');
  if (new Set(entries.map((e) => e.role)).size !== entries.length) errors.push('duplicate');
  if (entries.some((e) => !byId.has(e.role) || !byId.has(e.shown ?? e.role))) errors.push('not_in_script');

  const recommended = recommendedTeamCounts(seatCount);
  const actual = countByTeam(entries.map((e) => byId.get(e.role)).filter((r): r is RoleLike => r !== undefined));
  const offRecommendation = recommended
    ? TEAMS.filter((t) => actual[t] !== recommended[t]).map((team) => ({ team, actual: actual[team], recommended: recommended[team] }))
    : [];
  return { errors, offRecommendation };
}
