import { describe, expect, it } from 'vitest';
import { ALIGNMENT_LABEL, defaultAlignment, TEAM_LABEL, TEAMS } from '@/lib/game/teams';

describe('teams', () => {
  it.each([
    ['townsfolk', 'good'],
    ['outsider', 'good'],
    ['minion', 'evil'],
    ['demon', 'evil'],
  ] as const)('SETUP-04: %s starts %s', (team, alignment) => {
    expect(defaultAlignment(team)).toBe(alignment);
  });

  it('has a Chinese label for every team and alignment', () => {
    expect(TEAMS.map((t) => TEAM_LABEL[t])).toEqual(['镇民', '外来者', '爪牙', '恶魔']);
    expect(ALIGNMENT_LABEL).toEqual({ good: '善良', evil: '邪恶' });
  });
});
