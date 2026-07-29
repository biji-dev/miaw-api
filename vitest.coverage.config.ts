import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    workspace: './vitest.coverage.workspace.ts',
    testTimeout: 120000,
    hookTimeout: 120000,
    teardownTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/all',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', '**/*.d.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    reporter: ['verbose'],
  },
});
