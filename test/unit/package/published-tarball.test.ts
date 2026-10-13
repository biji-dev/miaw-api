/**
 * Guards what `npm publish` would ship.
 *
 * miaw-core 1.13.1 found that its tarball had carried development WhatsApp
 * sessions and a proxy credential list for every prior release: a denylist
 * fails silently on every name nobody thought of. This repo keeps the same
 * kinds of files on disk (sessions/, test-sessions/, proxies.live.txt,
 * .env.live-test), so publishing is restricted by the `files` allowlist in
 * package.json, and this test asks npm what it would actually pack.
 */

import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ALLOWED_TOP_LEVEL = new Set(['dist', 'package.json', 'README.md', 'CHANGELOG.md', '.env.example']);

// Credential-shaped paths: Baileys auth state, session stores, proxy lists, env files.
const SENSITIVE = [
  /(^|\/)(sessions|test-sessions)(\/|$)/,
  /(^|\/)creds\.json$/,
  /(^|\/)(pre-key|session|sender-key|app-state-sync-key)-[^/]*\.json$/,
  /(^|\/)proxies(?!\.[^/]*example)[^/]*\.txt$/,
  /(^|\/)\.env(?![^/]*\.example$)/,
];

function packedFiles(): string[] {
  // --ignore-scripts: the listing must not depend on, or trigger, a build.
  const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: new URL('../../..', import.meta.url),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return (JSON.parse(out) as Array<{ files: Array<{ path: string }> }>)[0].files.map((f) => f.path);
}

describe('published tarball', () => {
  const files = packedFiles();

  it('contains only allowlisted top-level entries', () => {
    const unexpected = files.filter((f) => !ALLOWED_TOP_LEVEL.has(f.split('/')[0]));
    expect(unexpected).toEqual([]);
  });

  it('contains nothing credential-shaped', () => {
    expect(files.filter((f) => SENSITIVE.some((re) => re.test(f)))).toEqual([]);
  });

  it('ships no source, tests, or local tooling config', () => {
    expect(files.filter((f) => /^(src|test|docs|coverage)\//.test(f))).toEqual([]);
    expect(files.filter((f) => /^(vitest|tsconfig|eslint|docker|Dockerfile|pnpm-)/.test(f))).toEqual([]);
  });
});
