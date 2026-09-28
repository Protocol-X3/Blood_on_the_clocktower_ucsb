import { describe, expect, it } from 'vitest';
import { baseName, charDiff, matchRoles, normalize, similarity, type LibraryRole } from '../../tools/lib/scriptPhoto.ts';

const LIB: LibraryRole[] = [
  { id: 'alhadikhia', name: '哈迪寂亚', team: 'demon', edition: 'exp', ability: '每个夜晚*，你可以选择三名玩家（所有玩家都会得知你选了谁）：他们分别秘密决定自己的生死，然后如果他们都存活则都死亡。' },
  { id: 'balloonist', name: '气球驾驶员', team: 'townsfolk', edition: 'exp', ability: '每个夜晚，你会得知一名与上个夜晚得知的玩家角色类型不同的玩家。[+0~1外来者]' },
  { id: 'balloonist_old', name: '气球驾驶员（旧版）', team: 'townsfolk', edition: 'exp', ability: '每个夜晚，你会得知一名不同角色类型的玩家，直到场上所有的角色类型你都得知过一次。[+1外来者]' },
  { id: 'nodashii', name: '诺-达鲺', team: 'demon', edition: 'snv', ability: '每个夜晚*，你要选择一名玩家：他死亡。与你邻近的两名镇民中毒。' },
  { id: 'custom-1', name: '卡牌大师', team: 'townsfolk', edition: 'homebrew', ability: '每个夜晚，你要选择一个善良角色（除你之外）和一个邪恶角色：你会得知这两个角色中是否至少有一个在场。' },
];

describe('script photo matching', () => {
  it('M6.2: punctuation, brackets, name dots and spacing do not count as differences', () => {
    expect(normalize('诺·达鲺')).toBe(normalize('诺-达鲺'));
    expect(normalize('（邻座的玩家距离为 1）。')).toBe(normalize('(邻座的玩家距离为1).'));
    expect(normalize('他死亡，与你')).toBe(normalize('他死亡,与你'));
    expect(normalize('存活的玩家')).not.toBe(normalize('玩家'));
  });

  it('M6.2: a version suffix is not part of the character', () => {
    expect(baseName('气球驾驶员（旧版）')).toBe('气球驾驶员');
    expect(baseName('戏子（改2）')).toBe('戏子');
    expect(baseName('戏子')).toBe('戏子');
  });

  it('M6.2: the diff shows exactly the changed words', () => {
    expect(charDiff('你可以选择三名玩家', '你要选择三名玩家')).toBe('你[+要-可以]选择三名玩家');
    expect(charDiff('选择一名玩家', '选择一名存活的玩家')).toBe('选择一名[+存活的]玩家');
    expect(charDiff('abc', 'abc')).toBe('abc');
    expect(similarity('abc', 'abc')).toBe(1);
    expect(similarity('', '')).toBe(1);
    expect(similarity('ab', 'cd')).toBe(0);
  });

  it('M6.2: a role matches by name; a one-word change shows up in the diff, not as identical', () => {
    const [m] = matchRoles([['demon', '哈迪寂亚', '每个夜晚*，你要选择三名玩家（所有玩家都会得知你选了谁）：他们分别秘密决定自己的生死，然后如果他们都存活则都死亡。']], LIB);
    expect(m).toMatchObject({ how: 'name', identical: false, teamDiffers: false });
    expect(m!.role!.id).toBe('alhadikhia');
    expect(m!.diff).toContain('[+要-可以]');
  });

  it('M6.2: other versions of the same character are listed, so the owner can pick one', () => {
    const [m] = matchRoles([['townsfolk', '气球驾驶员', '每个夜晚，你会得知一名不同角色类型的玩家，直到场上所有的角色类型你都得知过一次。[+1外来者]']], LIB);
    expect(m!.role!.id).toBe('balloonist');
    expect(m!.versions.map((v) => v.id)).toEqual(['balloonist_old']);
  });

  it('M6.2: punctuation-only differences and 自制角色 from earlier scripts match as identical', () => {
    const [a, b] = matchRoles(
      [
        ['demon', '诺·达鲺', '每个夜晚*，你要选择一名玩家：他死亡。与你邻近的两名镇民中毒。'],
        ['townsfolk', '卡牌大师', '每个夜晚，你要选择一个善良角色(除你之外)和一个邪恶角色：你会得知这两个角色中是否至少有一个在场。'],
      ],
      LIB,
    );
    expect(a).toMatchObject({ identical: true, diff: '' });
    expect(b!.role!.id).toBe('custom-1');
    expect(b!.identical).toBe(true);
  });

  it('M6.2: an unknown name matches by ability only when the text is close; otherwise it is new', () => {
    const [renamed, fresh, wrongTeam] = matchRoles(
      [
        ['demon', '诺达鲺二号', '每个夜晚*，你要选择一名玩家：他死亡。与你邻近的两名镇民中毒。'],
        ['townsfolk', '月光骑士', '每个夜晚，你会得知一名玩家是否醒来过。'],
        ['minion', '卡牌大师', '每个夜晚，你要选择一个善良角色（除你之外）和一个邪恶角色：你会得知这两个角色中是否至少有一个在场。'],
      ],
      LIB,
    );
    expect(renamed).toMatchObject({ how: 'ability', identical: true });
    expect(renamed!.role!.id).toBe('nodashii');
    expect(fresh).toMatchObject({ how: 'none', role: null, identical: false, diff: '', versions: [] });
    expect(wrongTeam!.teamDiffers).toBe(true);
  });
});
