// The official role library data (supabase/data/official-roles.json) and its checks.

export type Team = 'townsfolk' | 'outsider' | 'minion' | 'demon';
export type Edition = 'tb' | 'bmr' | 'snv' | 'exp' | 'hdcs';

export interface OfficialRole {
  id: string;
  edition: Edition;
  team: Team;
  name: string;
  glyph: string;
  ability: string;
  reminders: string[];
}

/**
 * LIB-01: every character of the three base editions, the Experimental characters
 * (实验性角色) and 华灯初上 (with its second season 山雨欲来), excluding Travellers,
 * Fabled and Lorics. Official characters use their standard script-tool ID; 华灯初上
 * characters use their pinyin, and a revised version (改) adds _gai.
 */
export const EDITION_IDS: Record<Edition, Record<Team, string[]>> = {
  tb: {
    townsfolk: ['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller', 'undertaker', 'monk', 'ravenkeeper', 'virgin', 'slayer', 'soldier', 'mayor'],
    outsider: ['butler', 'drunk', 'recluse', 'saint'],
    minion: ['poisoner', 'spy', 'scarletwoman', 'baron'],
    demon: ['imp'],
  },
  bmr: {
    townsfolk: ['grandmother', 'sailor', 'chambermaid', 'exorcist', 'innkeeper', 'gambler', 'gossip', 'courtier', 'professor', 'minstrel', 'tealady', 'pacifist', 'fool'],
    outsider: ['tinker', 'moonchild', 'goon', 'lunatic'],
    minion: ['godfather', 'devilsadvocate', 'assassin', 'mastermind'],
    demon: ['zombuul', 'pukka', 'shabaloth', 'po'],
  },
  snv: {
    townsfolk: ['clockmaker', 'dreamer', 'snakecharmer', 'mathematician', 'flowergirl', 'towncrier', 'oracle', 'savant', 'seamstress', 'philosopher', 'artist', 'juggler', 'sage'],
    outsider: ['mutant', 'sweetheart', 'barber', 'klutz'],
    minion: ['eviltwin', 'witch', 'cerenovus', 'pithag'],
    demon: ['fanggu', 'vigormortis', 'nodashii', 'vortox'],
  },
  exp: {
    townsfolk: ['lycanthrope', 'banshee', 'choirboy', 'preacher', 'villageidiot', 'engineer', 'princess', 'noble', 'king', 'general', 'alchemist', 'magician', 'farmer', 'highpriestess', 'balloonist', 'knight', 'bountyhunter', 'amnesiac', 'cannibal', 'steward', 'nightwatchman', 'atheist', 'alsaahir', 'pixie', 'shugenja', 'huntsman', 'cultleader', 'poppygrower', 'fisherman', 'acrobat'],
    outsider: ['snitch', 'puzzlemaster', 'zealot', 'damsel', 'hatter', 'golem', 'ogre', 'plaguedoctor', 'heretic', 'hermit', 'politician'],
    minion: ['goblin', 'widow', 'organgrinder', 'psychopath', 'boffin', 'fearmonger', 'mezepheles', 'marionette', 'wraith', 'vizier', 'wizard', 'xaan', 'harpy', 'boomdandy', 'summoner'],
    demon: ['ojo', 'riot', 'lordoftyphon', 'alhadikhia', 'legion', 'kazali', 'leviathan', 'lleech', 'lilmonsta', 'yaggababble'],
  },
  hdcs: {
    townsfolk: ['banxian', 'bianlianshi', 'dagengren', 'dianxiaoer', 'geling', 'heshang', 'jinyiwei', 'langzhong', 'qintianjian', 'wudaozhe', 'xizi', 'xionghaizi', 'yinyangshi', 'bingbi', 'chongfei', 'daoshi', 'fangshi', 'limao', 'qianke', 'tixingguan', 'xuncha', 'yinluren', 'yishi', 'zhen', 'zhifu', 'xizi_gai'],
    outsider: ['nichen', 'shaxing', 'shijie', 'shusheng', 'jiubao', 'rulianshi'],
    minion: ['ganshiren', 'humeiniang', 'jinweijun', 'yangguren', 'huapi', 'gudiao', 'mengpo', 'niangjiushi', 'jinweijun_gai'],
    demon: ['hundun', 'qiongqi', 'taotie', 'taowu', 'baojun', 'dianyuzhang', 'guhuoniao', 'jianning'],
  },
};

const HAN = /[一-鿿]/;

/** Validates the JSON and returns the roles; throws with every problem found. */
export function parseOfficialRoles(json: unknown): OfficialRole[] {
  if (!Array.isArray(json)) throw new Error('official roles must be an array');
  const problems: string[] = [];
  const roles = json as OfficialRole[];
  const seen = new Set<string>();
  for (const r of roles) {
    const where = `role ${r?.id ?? '?'}`;
    if (!r || typeof r.id !== 'string' || !/^[a-z0-9_-]+$/.test(r.id)) problems.push(`${where}: bad id`);
    if (seen.has(r.id)) problems.push(`${where}: duplicate`);
    seen.add(r.id);
    const expectedTeam = (Object.entries(EDITION_IDS[r.edition] ?? {}) as [Team, string[]][]).find(([, ids]) => ids.includes(r.id))?.[0];
    if (!expectedTeam) problems.push(`${where}: not a ${r.edition} character`);
    else if (r.team !== expectedTeam) problems.push(`${where}: team should be ${expectedTeam}`);
    if (typeof r.name !== 'string' || !HAN.test(r.name) || r.name.length > 20) problems.push(`${where}: needs a Chinese name`);
    if (typeof r.glyph !== 'string' || [...r.glyph].length !== 1) problems.push(`${where}: glyph must be one character`);
    if (typeof r.ability !== 'string' || !HAN.test(r.ability) || r.ability.length > 300) problems.push(`${where}: needs a Chinese ability`);
    if (!Array.isArray(r.reminders) || r.reminders.some((t) => typeof t !== 'string' || t.length > 8)) problems.push(`${where}: bad reminders`);
  }
  for (const [edition, teams] of Object.entries(EDITION_IDS)) {
    for (const ids of Object.values(teams)) for (const id of ids) if (!seen.has(id)) problems.push(`missing ${edition} character ${id}`);
  }
  if (problems.length) throw new Error(problems.join('\n'));
  return roles;
}

const q = (s: string) => `'${s.replaceAll("'", "''")}'`;

/** SQL that inserts or updates every official role. */
export function rolesUpsertSql(roles: OfficialRole[]): string {
  const rows = roles.map(
    (r) =>
      `  (${q(r.id)}, ${q(r.name)}, ${q(r.team)}, ${q(r.ability)}, ${q(r.glyph)}, array[${r.reminders.map(q).join(', ')}]::text[], ${q(r.edition)}, true)`,
  );
  return `-- Generated by tools/gen-roles-migration.ts from supabase/data/official-roles.json. Do not edit by hand.
-- LIB-01: the official role library (Trouble Brewing, Bad Moon Rising, Sects & Violets, Experimental, 华灯初上).
insert into public.roles (id, name, team, ability, glyph, reminders, edition, is_official) values
${rows.join(',\n')}
on conflict (id) do update set
  name = excluded.name, team = excluded.team, ability = excluded.ability, glyph = excluded.glyph,
  reminders = excluded.reminders, edition = excluded.edition, is_official = true;
`;
}
