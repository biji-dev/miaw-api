import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ProxyPoolService,
  assertProxyReachable,
  describeProxy,
  testProxy,
} from '../../../src/services/ProxyService.js';

const services: ProxyPoolService[] = [];
const tempDirectories: string[] = [];
const logger = {
  info: vi.fn(),
  warn: vi.fn(),
};

afterEach(async () => {
  services.splice(0).forEach((service) => service.close());
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
  vi.clearAllMocks();
});

async function proxyFile(content: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'miaw-api-proxies-'));
  tempDirectories.push(directory);
  const file = join(directory, 'proxies.txt');
  await writeFile(file, content, 'utf8');
  return file;
}

describe('ProxyPoolService', () => {
  it('is disabled when no file is configured', async () => {
    const service = await ProxyPoolService.create({
      strategy: 'deterministic',
      logger,
    });
    services.push(service);

    expect(service.getStatus()).toEqual({
      enabled: false,
      strategy: null,
      total: 0,
      eligible: 0,
      proxies: [],
    });
    expect(service.select('bot')).toBeUndefined();
  });

  it('loads, masks, and deterministically assigns proxy entries', async () => {
    const file = await proxyFile([
      'http://region-id:secret@proxy-a.test:8080 weight=2 label=jakarta',
      'socks5h://proxy-b.test:1080 label=singapore',
    ].join('\n'));
    const service = await ProxyPoolService.create({
      filePath: file,
      strategy: 'deterministic',
      logger,
    });
    services.push(service);

    const first = service.select('stable-bot');
    expect(service.select('stable-bot')).toEqual(first);
    expect(service.getStatus()).toMatchObject({
      enabled: true,
      strategy: 'deterministic',
      total: 2,
      eligible: 2,
    });
    expect(JSON.stringify(service.getStatus())).not.toContain('secret');
    expect(service.getStatus().proxies[0]).toMatchObject({
      weight: 2,
      label: 'jakarta',
    });
  });

  it('atomically reloads and retains the previous pool after a bad reload', async () => {
    const file = await proxyFile('http://proxy-a.test:8080');
    const service = await ProxyPoolService.create({
      filePath: file,
      strategy: 'deterministic',
      logger,
    });
    services.push(service);

    await writeFile(file, 'http://proxy-b.test:8080\nhttp://proxy-c.test:8080', 'utf8');
    await expect(service.reload()).resolves.toMatchObject({ total: 2 });

    await writeFile(file, 'ftp://invalid.test:21', 'utf8');
    await expect(service.reload()).rejects.toThrow();
    expect(service.getStatus()).toMatchObject({ total: 2 });
    expect(JSON.stringify(service.getStatus())).toContain('proxy-b.test');
  });
});

describe('proxy descriptions and tests', () => {
  it('describes HTTP and SOCKS media-download behavior without credentials', () => {
    expect(describeProxy('http://user:secret@proxy.test:8080', 'explicit'))
      .toMatchObject({
        source: 'explicit',
        protocol: 'http',
        downloadProxied: true,
      });
    expect(describeProxy('socks5h://proxy.test:1080', 'pool'))
      .toMatchObject({
        source: 'pool',
        protocol: 'socks5h',
        downloadProxied: false,
      });
    expect(JSON.stringify(
      describeProxy('http://user:secret@proxy.test:8080', 'explicit')
    )).not.toContain('secret');
  });

  it('returns successful and authentication-failed probe results', async () => {
    await expect(testProxy(
      'http://proxy.test:8080',
      1000,
      async () => 200
    )).resolves.toMatchObject({
      reachable: true,
      statusCode: 200,
      downloadProxied: true,
      error: null,
    });

    await expect(testProxy(
      'http://proxy.test:8080',
      1000,
      async () => 407
    )).resolves.toMatchObject({
      reachable: false,
      statusCode: 407,
      error: { code: 'EPROXYAUTH' },
    });
  });

  it('sanitizes credentials from probe failures', async () => {
    const timeout = Object.assign(
      new Error('connect http://region:secret@proxy.test:8080 failed: secret'),
      { code: 'ETIMEDOUT' }
    );
    const result = await testProxy(
      'http://region:secret@proxy.test:8080',
      1000,
      async () => {
        throw timeout;
      }
    );

    expect(result).toMatchObject({
      reachable: false,
      statusCode: null,
      error: { code: 'ETIMEDOUT' },
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});

describe('label pin resolution', () => {
  const poolFile = () =>
    proxyFile(
      [
        'http://region-id:secret@eu-1.test:8080 label=eu',
        'http://region-id:secret@eu-2.test:8080 label=eu',
        'socks5h://us-1.test:1080 label=us',
      ].join('\n')
    );

  const service = async () => {
    const created = await ProxyPoolService.create({
      filePath: await poolFile(),
      strategy: 'deterministic',
      logger,
    });
    services.push(created);
    return created;
  };

  it('resolves a label to a real entry, credentials included', async () => {
    // getStats() masks its URLs because it exists to be printed, so an agent
    // cannot be built from it - resolution must use the raw entries.
    const selected = (await service()).selectByLabel('us', 'bot');
    expect(selected.url).toBe('socks5h://us-1.test:1080');
  });

  it('keeps one instance on a stable entry when a label is shared', async () => {
    const pool = await service();
    const first = pool.selectByLabel('eu', 'bot-1');
    expect(pool.selectByLabel('eu', 'bot-1').url).toBe(first.url);
    expect(['http://region-id:secret@eu-1.test:8080', 'http://region-id:secret@eu-2.test:8080'])
      .toContain(first.url);
  });

  it('throws for an unknown label rather than falling back to a direct route', async () => {
    // Falling back would leak the real egress IP the pin exists to hide.
    await expect(async () => (await service()).selectByLabel('apac', 'bot')).rejects.toThrow(
      'no entry in the proxy pool carries it'
    );
  });

  it('throws when no pool is configured at all', async () => {
    const pool = await ProxyPoolService.create({ strategy: 'deterministic', logger });
    services.push(pool);
    expect(() => pool.selectByLabel('eu', 'bot')).toThrow('MIAW_PROXY_FILE');
  });

  it('picks up entries added by a reload', async () => {
    const file = await proxyFile('http://old.test:8080 label=eu');
    const pool = await ProxyPoolService.create({
      filePath: file,
      strategy: 'deterministic',
      logger,
    });
    services.push(pool);

    await writeFile(file, 'http://new.test:8080 label=eu\n', 'utf8');
    await pool.reload();

    expect(pool.selectByLabel('eu', 'bot').url).toBe('http://new.test:8080');
  });
});

describe('assertProxyReachable', () => {
  it('resolves when the probe succeeds', async () => {
    await expect(
      assertProxyReachable('http://proxy.test:8080', 1000, async () => 200)
    ).resolves.toBeUndefined();
  });

  it('rejects with a credential-free message when the probe fails', async () => {
    const fail = assertProxyReachable(
      { url: 'http://proxy.test:8080', username: 'region', password: 'secret' },
      1000,
      async () => {
        throw Object.assign(new Error('connect ECONNREFUSED http://region:secret@proxy.test:8080'), {
          code: 'ECONNREFUSED',
        });
      }
    );

    await expect(fail).rejects.toThrow(/not reachable/);
    const error = await fail.catch((e: Error) => e);
    expect(error.message).not.toContain('secret');
    expect(error.message).toContain('****');
  });
});
