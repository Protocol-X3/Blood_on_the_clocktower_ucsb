import { describe, expect, it } from 'vitest';
import { findSandboxCode, SANDBOX_MARKERS } from '../../tools/lib/sandbox.ts';

describe('bot-sandbox scan', () => {
  it('BOT-01: finds any sandbox marker in built files', () => {
    for (const marker of SANDBOX_MARKERS) {
      expect(findSandboxCode([{ path: 'dist/a.js', text: `x("${marker}")` }])).toEqual([{ path: 'dist/a.js', marker }]);
    }
  });

  it('BOT-01: a clean build passes', () => {
    expect(findSandboxCode([{ path: 'dist/a.js', text: 'supabase.rpc("draw_card")' }, { path: 'dist/index.html', text: '<div id="root"></div>' }])).toEqual([]);
  });
});
