import { spawnSync } from 'node:child_process';

const result = spawnSync(
  process.execPath,
  ['./node_modules/vitest/vitest.mjs', 'run', '-c', 'vitest.live.config.ts'],
  { stdio: 'inherit', env: { ...process.env, MIAW_RUN_LIVE_TESTS: 'true' } },
);

process.exit(result.status ?? 1);
