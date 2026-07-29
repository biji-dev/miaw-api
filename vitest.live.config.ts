import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/live/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 180000,
    hookTimeout: 180000,
    teardownTimeout: 30000,
    fileParallelism: false,
    pool: 'threads',
    poolOptions: { threads: { singleThread: true } },
    reporter: ['verbose'],
  },
});
