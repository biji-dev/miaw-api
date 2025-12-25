import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/integration/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 120000,
    hookTimeout: 120000,
    teardownTimeout: 30000,
    isolate: false,
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    reporter: ['verbose'],
  },
});
