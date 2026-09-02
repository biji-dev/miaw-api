/**
 * Live proxy pool check.
 *
 *   pnpm test:proxies                      # reads ./proxies.live.txt
 *   MIAW_PROXY_FILE=/path/to/pool pnpm test:proxies
 *   pnpm test:proxies --no-egress          # skip the third-party IP lookup
 *
 * Answers the three questions a mock never can:
 *   1. does every entry parse,
 *   2. can each one actually reach WhatsApp,
 *   3. does traffic really leave through it, rather than falling back direct.
 *
 * Exits non-zero if any proxy fails or if the real egress IP leaks, so it can
 * gate a deploy. Requires a built dist (`pnpm build`) for the probe, which is
 * the same code path `POST /api/v1/proxy-tests` serves.
 *
 * Passwords are never printed. The pool file itself is a secret: keep it 0600
 * and out of git.
 */

import { get } from 'node:https';
import { existsSync, statSync } from 'node:fs';
import { loadProxyList, createProxyAgents, maskProxyUrl } from 'miaw-core';
import { testProxy } from '../../dist/services/ProxyService.js';

const POOL = process.env.MIAW_PROXY_FILE || './proxies.live.txt';
const CHECK_EGRESS = !process.argv.includes('--no-egress');
const TIMEOUT = Number(process.env.MIAW_PROXY_TIMEOUT_MS || 15000);

/** Host:port only - never the credentials. */
const hostOf = (url) => url.replace(/^[a-z0-9+.-]+:\/\/[^@]*@/i, '').replace(/\/$/, '');

function fetchText(url, agent) {
  return new Promise((resolve, reject) => {
    const request = get(url, agent ? { agent } : {}, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve(body.trim()));
    });
    request.setTimeout(TIMEOUT, () => request.destroy(new Error('timed out')));
    request.once('error', reject);
  });
}

if (!existsSync(POOL)) {
  console.error(`No proxy pool at ${POOL}.`);
  console.error('Copy proxies.live.example.txt to proxies.live.txt and fill it in,');
  console.error('or point MIAW_PROXY_FILE at your own list.');
  process.exit(1);
}

const mode = statSync(POOL).mode & 0o777;
if (mode & 0o077) {
  console.warn(`WARNING  ${POOL} is mode ${mode.toString(8)} and holds credentials. chmod 600 it.\n`);
}

const entries = await loadProxyList(POOL, { strict: true });
console.log(`${POOL}: ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}\n`);

let realIp = null;
if (CHECK_EGRESS) {
  try {
    realIp = await fetchText('https://api.ipify.org', null);
    console.log(`This host's real egress IP: ${realIp}`);
    console.log('Any proxy reporting that IP is not carrying traffic.\n');
  } catch (error) {
    console.warn(`Could not determine the real IP (${error.message}); leak detection is off.\n`);
  }
}

const results = await Promise.all(entries.map(async (entry) => {
  const probe = await testProxy(entry.url, TIMEOUT);
  let exitIp = null;
  let egressError = null;

  if (CHECK_EGRESS && probe.reachable) {
    let agents;
    try {
      agents = await createProxyAgents(entry.url);
      exitIp = await fetchText('https://api.ipify.org', agents.wsAgent);
    } catch (error) {
      egressError = error.message;
    } finally {
      agents?.wsAgent.destroy();
      try { await agents?.downloadDispatcher?.close?.(); } catch { /* best effort */ }
    }
  }

  return { entry, probe, exitIp, egressError };
}));

let failures = 0;
let leaks = 0;

for (const { entry, probe, exitIp, egressError } of results) {
  const leaked = exitIp !== null && exitIp === realIp;
  if (!probe.reachable) failures++;
  if (leaked) leaks++;

  const status = !probe.reachable ? 'FAIL' : leaked ? 'LEAK' : 'ok';
  const detail = probe.reachable
    ? `${String(probe.statusCode).padEnd(4)} ${String(probe.latencyMs + 'ms').padEnd(8)}` +
      `exit=${(exitIp ?? egressError ?? 'not checked').padEnd(16)}` +
      `downloads=${probe.downloadProxied ? 'proxied' : 'DIRECT'}`
    : `${probe.error?.code ?? 'error'}: ${probe.error?.message?.slice(0, 60) ?? ''}`;

  console.log(
    `${status.padEnd(5)} ${hostOf(entry.url).padEnd(24)} ` +
    `${(entry.label ? `[${entry.label}]` : '').padEnd(14)} ${detail}`
  );
}

const socks = results.filter((r) => !r.probe.downloadProxied);
if (socks.length) {
  console.log(
    `\nNote: ${socks.length} SOCKS ${socks.length === 1 ? 'entry' : 'entries'} above carry the ` +
    'WhatsApp session and media uploads, but media DOWNLOADS go direct and reveal ' +
    'the real IP. Prefer HTTP(S) when that matters.'
  );
}

const labels = [...new Set(entries.map((e) => e.label).filter(Boolean))];
console.log(
  `\n${entries.length - failures}/${entries.length} reachable` +
  (leaks ? `, ${leaks} LEAKING the real IP` : '') +
  (labels.length ? `\nLabels available for credential-free assignment: ${labels.join(', ')}` : '') +
  (labels.length ? '\n  PUT /api/v1/instances/:id/proxy  {"proxy":{"label":"' + labels[0] + '"}}' : '')
);

if (failures || leaks) process.exit(1);
