import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig(({ mode }) => {
  // Integration tests reach the Supabase project named in .env.local (locally)
  // or in the CI environment (Docker Supabase). Existing process env wins.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': src } },
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/tools/**/*.test.ts'],
            environment: 'jsdom',
            setupFiles: ['tests/unit/setup.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'integration',
            include: ['tests/integration/**/*.test.ts'],
            environment: 'node',
            env,
            fileParallelism: false,
            testTimeout: 60_000,
            hookTimeout: 60_000,
          },
        },
      ],
      coverage: {
        provider: 'v8',
        // Pages and features are covered by E2E tests (architecture.md, Quality gates).
        include: ['src/lib/**/*.ts', 'src/components/**/*.{ts,tsx}'],
        exclude: ['src/**/*.d.ts'],
        reporter: ['text-summary', 'json-summary'],
        thresholds: {
          // QA-03
          'src/lib/**': { lines: 100, branches: 95, functions: 100, statements: 100 },
          lines: 70,
        },
      },
    },
  };
});
