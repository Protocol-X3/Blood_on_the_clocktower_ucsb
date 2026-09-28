import { TEAMS, type Team } from '@/lib/game/teams';
import type { Database } from '@/services/database.types';

export type Role = Database['public']['Tables']['roles']['Row'];
export type Script = Database['public']['Tables']['scripts']['Row'];

export const EDITION_LABEL: Record<string, string> = {
  tb: '暗流涌动',
  bmr: '黯月初升',
  snv: '梦殒春宵',
};

/** Roles grouped by team, in the order Townsfolk, Outsiders, Minions, Demons (SCRIPT-05). */
export function groupByTeam<T extends { team: Team }>(roles: T[]): { team: Team; roles: T[] }[] {
  return TEAMS.map((team) => ({ team, roles: roles.filter((r) => r.team === team) })).filter((g) => g.roles.length > 0);
}
