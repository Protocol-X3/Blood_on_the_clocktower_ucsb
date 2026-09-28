export const TEAMS = ['townsfolk', 'outsider', 'minion', 'demon'] as const;
export type Team = (typeof TEAMS)[number];

export type Alignment = 'good' | 'evil';

export const TEAM_LABEL: Record<Team, string> = {
  townsfolk: '镇民',
  outsider: '外来者',
  minion: '爪牙',
  demon: '恶魔',
};

export const ALIGNMENT_LABEL: Record<Alignment, string> = {
  good: '善良',
  evil: '邪恶',
};

/** SETUP-04: a seat's starting alignment comes from its actual role's team. */
export function defaultAlignment(team: Team): Alignment {
  return team === 'townsfolk' || team === 'outsider' ? 'good' : 'evil';
}
