import type { Team } from './teams';

export type TeamCounts = Record<Team, number>;

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 15;

// Official base distribution [townsfolk, outsider, minion, demon],
// indexed by player count − 5 (SETUP-01).
const TABLE: ReadonlyArray<readonly [number, number, number, number]> = [
  [3, 0, 1, 1],
  [3, 1, 1, 1],
  [5, 0, 1, 1],
  [5, 1, 1, 1],
  [5, 2, 1, 1],
  [7, 0, 2, 1],
  [7, 1, 2, 1],
  [7, 2, 2, 1],
  [9, 0, 3, 1],
  [9, 1, 3, 1],
  [9, 2, 3, 1],
];

/**
 * Recommended team counts for a player count, shown as a hint in the setup
 * wizard. Returns null outside the supported 5–15 range (SETUP-03).
 */
export function recommendedTeamCounts(players: number): TeamCounts | null {
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > MAX_PLAYERS) return null;
  const [townsfolk, outsider, minion, demon] = TABLE[players - MIN_PLAYERS]!;
  return { townsfolk, outsider, minion, demon };
}
