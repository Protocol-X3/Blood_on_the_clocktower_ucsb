import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './files.ts';

/**
 * Runs the project's Supabase CLI directly through node, without a shell, so
 * arguments such as a database URL with special characters pass through intact.
 */
export function supabaseCli(args: string[], inherit = false): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [join(ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js'), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : 'pipe',
  });
}
