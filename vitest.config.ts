/**
 * Vitest Configuration for Unit Tests
 * Run with: npm run test:unit
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/unit/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/unit',
      exclude: [
        'test/**',
        'dist/**',
        'node_modules/**',
        '**/*.d.ts',
        'vitest.*.ts',
      ],
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
