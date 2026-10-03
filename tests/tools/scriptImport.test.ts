// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEnvFile, withEnvValue } from '../../tools/lib/files.ts';
import { explainImportError, importEnv, roleNameClashes, type ScriptSpec } from '../../tools/lib/scriptImport.ts';

const spec: ScriptSpec = {
  name: '钟声来了',
  author: 'Bruce C.',
  roles: ['clockmaker', { custom: { name: ' 卡牌大师 ', team: 'townsfolk', ability: '…', glyph: '牌' } }, { custom: { name: '新角色', team: 'minion', ability: '…' } }],
};

describe('script-from-photo tools over HTTPS', () => {
  it('SCRIPT-07: the tools need the Supabase URL, the publishable key and the import token, and nothing more', () => {
    expect(importEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x', SCRIPT_IMPORT_TOKEN: 't' })).toEqual({
      url: 'https://x.supabase.co',
      key: 'sb_publishable_x',
      token: 't',
    });
    expect(importEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toEqual({ missing: ['VITE_SUPABASE_PUBLISHABLE_KEY', 'SCRIPT_IMPORT_TOKEN'] });
    expect(importEnv({ SUPABASE_DB_URL: 'postgres://…', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x' })).toEqual({
      missing: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY', 'SCRIPT_IMPORT_TOKEN'],
    });
  });

  it('SCRIPT-07: neither tool opens a direct database connection or reads the database password', () => {
    for (const f of ['tools/compare-script.ts', 'tools/save-script.ts']) {
      const src = readFileSync(f, 'utf8');
      expect(src).not.toMatch(/from 'pg'|SUPABASE_DB_URL|SERVICE_ROLE/);
      expect(src).toMatch(/importEnv\(/);
    }
  });

  it('SCRIPT-07: a custom role whose name is taken is caught before anything is created, naming the clash', () => {
    const library = [
      { id: 'custom-d4f7fb6107', name: '卡牌大师', edition: 'homebrew' },
      { id: 'clockmaker', name: '钟表匠', edition: 'snv' },
    ];
    expect(roleNameClashes(spec, library)).toEqual(['a role named  卡牌大师  already exists (custom-d4f7fb6107, homebrew); use its id or pick another name']);
    expect(roleNameClashes({ ...spec, roles: ['clockmaker'] }, library)).toEqual([]);
  });

  it("SCRIPT-07: the database's refusals are explained, with the script's name where it matters", () => {
    expect(explainImportError('IMPORT_TOKEN_INVALID')).toMatch(/node tools\/db\.ts import-token/);
    expect(explainImportError('SCRIPT_NAME_TAKEN', spec)).toBe('a script named 钟声来了 already exists; ask the owner (replace, new name or stop)');
    expect(explainImportError('SCRIPT_NOT_FOUND', spec)).toMatch(/no script named 钟声来了/);
    for (const code of ['ADMIN_NOT_SIGNED_IN', 'ROLE_NAME_TAKEN', 'IMPORT_SPEC_INVALID']) expect(explainImportError(code)).not.toBe(code);
    expect(explainImportError('SCRIPT_EMPTY')).toBe('SCRIPT_EMPTY');
  });

  it('SCRIPT-08: a spec carries the sheet’s 特殊规则; the tool says what to do when they are too long', () => {
    const withRules: ScriptSpec = { ...spec, special_rules: '每局游戏至少有一名外来者。' };
    expect(roleNameClashes(withRules, [])).toEqual([]);
    expect(explainImportError('SCRIPT_RULES_TOO_LONG', withRules)).toMatch(/2000/);
    expect(explainImportError('IMPORT_SPEC_INVALID')).toMatch(/special_rules/);
    // save-script prints the 特殊规则 as saved, so the dry run's readback shows them.
    expect(readFileSync('tools/save-script.ts', 'utf8')).toMatch(/saved\.special_rules/);
  });

  it('SCRIPT-07: a new token replaces the old one in .env.local and leaves every other line alone', () => {
    const before = 'VITE_SUPABASE_URL=https://x.supabase.co\r\nSCRIPT_IMPORT_TOKEN=old\r\nADMIN_EMAIL=a@b.c\r\n';
    const after = withEnvValue(before, 'SCRIPT_IMPORT_TOKEN', 'new$&');
    expect(parseEnvFile(after)).toEqual({ VITE_SUPABASE_URL: 'https://x.supabase.co', SCRIPT_IMPORT_TOKEN: 'new$&', ADMIN_EMAIL: 'a@b.c' });
    expect(after.split('\n')).toHaveLength(before.split('\n').length);
    expect(withEnvValue('A=1', 'SCRIPT_IMPORT_TOKEN', 't')).toBe('A=1\nSCRIPT_IMPORT_TOKEN=t\n');
    expect(withEnvValue('', 'SCRIPT_IMPORT_TOKEN', 't')).toBe('SCRIPT_IMPORT_TOKEN=t\n');
    expect(withEnvValue('MY_SCRIPT_IMPORT_TOKEN=x\n', 'SCRIPT_IMPORT_TOKEN', 't')).toBe('MY_SCRIPT_IMPORT_TOKEN=x\nSCRIPT_IMPORT_TOKEN=t\n');
  });
});
