import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Flat config for Stryker: its Vitest runner doesn't support `test.projects`
// (architecture.md, Known tooling pitfalls).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/unit/lib/**/*.test.ts'],
    environment: 'node',
  },
});
