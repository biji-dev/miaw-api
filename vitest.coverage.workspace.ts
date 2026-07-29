import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      globals: true,
      include: ['test/unit/**/*.test.ts'],
      exclude: ['node_modules', 'dist', 'test/live/**'],
      testTimeout: 10000,
    },
  },
  {
    test: {
      name: 'integration',
      globals: true,
      include: ['test/integration/**/*.test.ts'],
      exclude: ['node_modules', 'dist', 'test/live/**'],
      testTimeout: 120000,
      hookTimeout: 120000,
      teardownTimeout: 30000,
      isolate: false,
      fileParallelism: false,
      pool: 'threads',
      poolOptions: {
        threads: {
          singleThread: true,
        },
      },
    },
  },
]);
