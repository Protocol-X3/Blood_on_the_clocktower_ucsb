// Matching a script photo's roles against the role library (M6, the script-from-photo skill).
// A photo is transcribed as [team, name, ability] rows; each row is matched to a library role
// by name, or failing that by the most similar ability, and the ability text is diffed so the
// real differences can be judged by meaning.

export type Team = 'townsfolk' | 'outsider' | 'minion' | 'demon';
export type PhotoRole = [team: Team, name: string, ability: string];
export interface LibraryRole {
  id: string;
  name: string;
  team: Team;
  ability: string;
  edition: string | null;
}
export interface RoleMatch {
  photo: PhotoRole;
  /** The library role this row most likely is, or null when nothing comes close. */
  role: LibraryRole | null;
  how: 'name' | 'ability' | 'none';
  /** Similarity of the abilities after normalizing, 0–1. */
  similarity: number;
  /** Identical apart from punctuation and spacing. */
  identical: boolean;
  teamDiffers: boolean;
  /** Character diff of library → photo, e.g. "你[+要-可以]选择"; empty when identical. */
  diff: string;
  /** Other library roles that are versions of the same character (e.g. 气球驾驶员（旧版）). */
  versions: LibraryRole[];
}

/** Below this ability similarity, a row with an unknown name is treated as a new role. */
export const SAME_ROLE_THRESHOLD = 0.6;

/** Punctuation, brackets, name dots and spacing vary between sheets without changing meaning. */
export function normalize(text: string): string {
  return text
    .replace(/\s+/g, '')
    .replace(/[()（）[\]［］【】]/g, '')
    .replace(/[·・\-‐－]/g, '')
    .replace(/[“”"「」『』]/g, '"')
    .replace(/[，,]/g, '，')
    .replace(/[：:]/g, '：')
    .replace(/[；;]/g, '；')
    .replace(/[。.]/g, '。');
}

/** The character a role is a version of: 气球驾驶员（旧版） and 戏子（改2） → 气球驾驶员, 戏子. */
export function baseName(name: string): string {
  return name.replace(/[（(][^）)]*[）)]$/, '').trim();
}

function lcsTable(a: string[], b: string[]): Int32Array[] {
  const dp = Array.from({ length: a.length + 1 }, () => new Int32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  return dp;
}

/** How alike two texts are, 0–1 (twice the longest common subsequence over the total length). */
export function similarity(a: string, b: string): number {
  const A = [...a];
  const B = [...b];
  if (A.length + B.length === 0) return 1;
  return (2 * lcsTable(A, B)[0]![0]!) / (A.length + B.length);
}

/** A character diff from `from` to `to`: unchanged text as is, changes as [+added-removed]. */
export function charDiff(from: string, to: string): string {
  const A = [...from];
  const B = [...to];
  const dp = lcsTable(A, B);
  let i = 0;
  let j = 0;
  let out = '';
  let add = '';
  let del = '';
  const flush = () => {
    if (add || del) out += `[${add ? `+${add}` : ''}${del ? `-${del}` : ''}]`;
    add = '';
    del = '';
  };
  while (i < A.length || j < B.length) {
    if (i < A.length && j < B.length && A[i] === B[j]) {
      flush();
      out += A[i];
      i++;
      j++;
    } else if (j < B.length && (i >= A.length || dp[i]![j + 1]! >= dp[i + 1]![j]!)) {
      add += B[j];
      j++;
    } else {
      del += A[i];
      i++;
    }
  }
  flush();
  return out;
}

/** Matches every photo row against the library. */
export function matchRoles(photo: PhotoRole[], library: LibraryRole[]): RoleMatch[] {
  return photo.map((row) => {
    const [team, name, ability] = row;
    let role = library.find((r) => normalize(r.name) === normalize(name)) ?? null;
    let how: RoleMatch['how'] = role ? 'name' : 'none';
    if (!role) {
      const best = library
        .map((r) => ({ r, s: similarity(normalize(r.ability), normalize(ability)) }))
        .sort((p, q) => q.s - p.s)[0];
      if (best && best.s >= SAME_ROLE_THRESHOLD) {
        role = best.r;
        how = 'ability';
      }
    }
    const sim = role ? similarity(normalize(role.ability), normalize(ability)) : 0;
    const identical = !!role && normalize(role.ability) === normalize(ability);
    const base = baseName(role?.name ?? name);
    return {
      photo: row,
      role,
      how,
      similarity: sim,
      identical,
      teamDiffers: !!role && role.team !== team,
      diff: role && !identical ? charDiff(role.ability, ability) : '',
      versions: library.filter((r) => r.id !== role?.id && baseName(r.name) === base),
    };
  });
}
