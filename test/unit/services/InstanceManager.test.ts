/**
 * Unit tests for InstanceManager service
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

const coreMock = vi.hoisted(() => ({ clients: [] as any[], options: [] as any[], calls: [] as string[] }));

// Mock miaw-core so createInstance does not spin up a real WhatsApp client
vi.mock('miaw-core', () => {
  class MiawClient {
    handlers = new Map<string, (...args: any[]) => void>();
    on = vi.fn((event: string, handler: (...args: any[]) => void) => {
      this.handlers.set(event, handler);
      return this;
    });
    removeAllListeners = vi.fn();
    disconnect = vi.fn(async () => { this.connected = false; coreMock.calls.push('disconnect'); });
    connect = vi.fn(async () => { this.connected = true; coreMock.calls.push('connect'); });
    getOwnProfile = vi.fn(async () => ({ phone: '6281' }));
    connected = false;
    options: any;

    // Mirrors miaw-core: stages for the next connect(), never throws, and is
    // refused outright when the client owns a custom agent.
    setProxy = vi.fn((proxy: any) => {
      coreMock.calls.push('setProxy');
      const reconnectRequired = this.connected;
      if (this.options?.agent || this.options?.fetchAgent) {
        return { success: false, reconnectRequired: false, error: 'Cannot set proxy: this client was constructed with a custom agent/fetchAgent.' };
      }
      if (proxy === null || proxy === undefined) {
        this.options = { ...this.options, proxy: undefined };
        return { success: true, reconnectRequired };
      }
      const raw = typeof proxy === 'string' ? proxy : proxy.url;
      if (!/^(https?|socks|socks4|socks4a|socks5|socks5h):\/\//.test(raw)) {
        return { success: false, reconnectRequired: false, error: `Invalid proxy configuration: ${raw}` };
      }
      this.options = { ...this.options, proxy };
      return { success: true, proxy: raw, reconnectRequired };
    });

    getProxyInfo = vi.fn(() => {
      const proxy = this.options?.proxy;
      if (!proxy) return null;
      const raw = typeof proxy === 'string' ? proxy : proxy.url;
      const url = new URL(raw);
      if (url.password) url.password = '****';
      return {
        url: url.toString(),
        protocol: url.protocol.replace(':', ''),
        active: this.connected,
      };
    });

    constructor(opts: unknown) {
      this.options = opts;
      coreMock.clients.push(this);
      coreMock.options.push(opts);
    }
    emitTest(event: string, ...args: any[]) { this.handlers.get(event)?.(...args); }
  }
  return {
    MiawClient,
    validateProxyConfig: (proxy: string | { url: string }) => {
      const raw = typeof proxy === 'string' ? proxy : proxy.url;
      return /^(https?|socks|socks4|socks4a|socks5|socks5h):\/\//.test(raw);
    },
    maskProxyUrl: (proxy: string | { url: string; password?: string }) => {
      const raw = typeof proxy === 'string' ? proxy : proxy.url;
      const url = new URL(raw);
      if (typeof proxy !== 'string' && proxy.password) url.password = proxy.password;
      if (url.password) url.password = '****';
      return url.toString();
    },
  };
});

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { InstanceManager } from '../../../src/services/InstanceManager.js';
import {
  InstanceStore,
  getInstanceStorePath,
} from '../../../src/services/InstanceStore.js';

describe('InstanceManager.updateWebhook', () => {
  let manager: InstanceManager;

  beforeEach(() => {
    coreMock.clients.length = 0;
    coreMock.options.length = 0;
    coreMock.calls.length = 0;
    manager = new InstanceManager({
      sessionPath: './sessions',
      webhookSecret: 'test-secret',
      webhookTimeout: 1000,
      webhookMaxRetries: 3,
      webhookRetryDelay: 1000,
    });
  });

  it('updates webhookUrl and recomputes webhookEnabled', async () => {
    await manager.createInstance({ instanceId: 'bot' });

    const state = manager.updateWebhook('bot', {
      webhookUrl: 'https://example.test/hook',
    });

    expect(state.webhookUrl).toBe('https://example.test/hook');
    expect(state.webhookEnabled).toBe(true);
  });

  it('updates webhookEvents without touching webhookUrl', async () => {
    await manager.createInstance({
      instanceId: 'bot',
      webhookUrl: 'https://example.test/hook',
    });

    const state = manager.updateWebhook('bot', {
      webhookEvents: ['message', 'qr'],
    });

    expect(state.webhookEvents).toEqual(['message', 'qr']);
    expect(state.webhookUrl).toBe('https://example.test/hook');
    expect(state.webhookEnabled).toBe(true);
  });

  it('clears the webhook when webhookUrl is null', async () => {
    await manager.createInstance({
      instanceId: 'bot',
      webhookUrl: 'https://example.test/hook',
    });

    const state = manager.updateWebhook('bot', { webhookUrl: null });

    expect(state.webhookUrl).toBeUndefined();
    expect(state.webhookEnabled).toBe(false);
  });

  it('leaves fields unchanged when not provided', async () => {
    await manager.createInstance({
      instanceId: 'bot',
      webhookUrl: 'https://example.test/hook',
      webhookEvents: ['message'],
    });

    const state = manager.updateWebhook('bot', {});

    expect(state.webhookUrl).toBe('https://example.test/hook');
    expect(state.webhookEvents).toEqual(['message']);
  });

  it('throws when the instance does not exist', () => {
    expect(() =>
      manager.updateWebhook('missing', { webhookUrl: 'https://x.test' })
    ).toThrow('not found');
  });

  it('passes serializable client options and tracks pairing challenges', async () => {
    const state = await manager.createInstance({
      instanceId: 'pairing-bot',
      clientOptions: { usePairingCode: true, phoneNumber: '628123', debug: true },
    });
    expect(coreMock.options[0]).toMatchObject({
      instanceId: 'pairing-bot', usePairingCode: true, phoneNumber: '628123', debug: true,
    });
    expect(state.authMode).toBe('pairing_code');
    coreMock.clients[0].emitTest('pairing_code', 'ABCD1234');
    expect(manager.getAuthChallenge('pairing-bot', 'pairing_code')).toBe('ABCD1234');
    coreMock.clients[0].emitTest('ready');
    expect(manager.getAuthChallenge('pairing-bot', 'pairing_code')).toBeNull();
  });

  it('retries the pairing-code request after the socket handshake window', async () => {
    vi.useFakeTimers();
    try {
      await manager.createInstance({
        instanceId: 'pairing-bot',
        clientOptions: { usePairingCode: true, phoneNumber: '628123' },
      });
      const requestPairingCode = vi.fn(async () => 'WXYZ9876');
      coreMock.clients[0].socket = { requestPairingCode };

      await vi.advanceTimersByTimeAsync(3000);

      expect(requestPairingCode).toHaveBeenCalledWith('628123');
      expect(manager.getAuthChallenge('pairing-bot', 'pairing_code')).toBe('WXYZ9876');
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(['message_receipt', 'poll_vote', 'session_saved'] as const)(
    'forwards the %s core event once',
    async (event) => {
      await manager.createInstance({
        instanceId: 'bot', webhookUrl: 'https://example.test/hook', webhookEvents: [event],
      });
      const delivered = vi.fn();
      manager.on('webhook', delivered);
      coreMock.clients[0].emitTest(event, { value: event });
      expect(delivered).toHaveBeenCalledTimes(1);
      expect(delivered.mock.calls[0][1]).toMatchObject({ event, instanceId: 'bot' });
    }
  );

  it('includes the disconnect status code in its webhook', async () => {
    await manager.createInstance({
      instanceId: 'bot', webhookUrl: 'https://example.test/hook', webhookEvents: ['disconnected'],
    });
    const delivered = vi.fn();
    manager.on('webhook', delivered);
    coreMock.clients[0].emitTest('disconnected', 'logged out', 401);
    expect(delivered.mock.calls[0][1].data).toEqual({ reason: 'logged out', statusCode: 401 });
  });

  it('stages a replacement proxy on the same client instead of rebuilding it', async () => {
    await manager.createInstance({
      instanceId: 'bot',
      webhookUrl: 'https://example.test/hook',
      clientOptions: { debug: true, autoReconnect: false },
    });

    const result = await manager.replaceProxy(
      'bot',
      'http://region:secret@proxy.test:8080'
    );

    // Reusing the client is the point: a second MiawClient on the same
    // sessionPath/instanceId would give two writers on one auth state.
    expect(coreMock.clients).toHaveLength(1);
    expect(coreMock.clients[0].removeAllListeners).not.toHaveBeenCalled();
    // Normalized through the URL parser, exactly as miaw-core's buildProxyUrl
    // does, so a pin written here is byte-identical to a miaw-cli one.
    expect(coreMock.clients[0].setProxy).toHaveBeenCalledWith(
      'http://region:secret@proxy.test:8080/'
    );
    // Already disconnected, so nothing is torn down and nothing reconnects.
    expect(coreMock.calls).toEqual(['setProxy']);
    expect(result).toMatchObject({
      source: 'explicit',
      protocol: 'http',
      downloadProxied: true,
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(manager.getInstance('bot')?.webhookUrl).toBe('https://example.test/hook');
  });

  it('disconnects before staging and reconnects after, when forced', async () => {
    await manager.createInstance({ instanceId: 'bot' });
    coreMock.clients[0].emitTest('connection', 'connected');

    await manager.replaceProxy('bot', 'http://proxy.test:8080', { force: true });

    // Order is load-bearing: staging before the teardown would let an
    // auto-reconnect fire on the old egress.
    expect(coreMock.calls).toEqual(['disconnect', 'setProxy', 'connect']);
    expect(coreMock.clients).toHaveLength(1);
  });

  it('reports a core setProxy rejection instead of applying it', async () => {
    await manager.createInstance({ instanceId: 'bot' });
    coreMock.clients[0].setProxy.mockReturnValueOnce({
      success: false,
      reconnectRequired: false,
      error: 'Invalid proxy configuration: http://nope',
    });

    await expect(
      manager.replaceProxy('bot', 'http://proxy.test:8080')
    ).rejects.toThrow('Invalid proxy configuration');
    expect(manager.getProxy('bot').source).toBe('none');
  });

  it('rebuilds the client only when core refuses to stage on a custom agent', async () => {
    await manager.createInstance({ instanceId: 'bot' });
    coreMock.clients[0].setProxy.mockReturnValueOnce({
      success: false,
      reconnectRequired: false,
      error: 'Cannot set proxy: this client was constructed with a custom agent/fetchAgent.',
    });

    const result = await manager.replaceProxy('bot', 'http://proxy.test:8080');

    expect(coreMock.clients).toHaveLength(2);
    expect(coreMock.clients[0].removeAllListeners).toHaveBeenCalledOnce();
    expect(coreMock.options[1]).toMatchObject({ proxy: 'http://proxy.test:8080/' });
    expect(result.source).toBe('explicit');
  });

  it.each(['connected', 'connecting', 'reconnecting', 'qr_required'])(
    'rejects proxy replacement while the instance is %s',
    async (status) => {
      await manager.createInstance({ instanceId: 'bot' });
      coreMock.clients[0].emitTest('connection', status);

      await expect(
        manager.replaceProxy('bot', 'http://proxy.test:8080')
      ).rejects.toThrow('must be disconnected');
      expect(coreMock.clients[0].setProxy).not.toHaveBeenCalled();
    }
  );

  it('uses the pool by default, supports an override, and returns to the pool', async () => {
    const pooledProxy = { url: 'socks5h://pool.test:1080', label: 'pool' };
    const select = vi.fn(() => pooledProxy);
    const pooledManager = new InstanceManager({
      sessionPath: './sessions',
      webhookSecret: 'test-secret',
      webhookTimeout: 1000,
      webhookMaxRetries: 3,
      webhookRetryDelay: 1000,
      proxyPool: { select } as any,
    });

    await pooledManager.createInstance({ instanceId: 'bot' });
    expect(coreMock.options[0]).toMatchObject({ proxy: pooledProxy });
    expect(pooledManager.getProxy('bot').source).toBe('pool');

    await pooledManager.replaceProxy('bot', 'http://override.test:8080');
    expect(pooledManager.getProxy('bot').source).toBe('explicit');

    const restored = await pooledManager.replaceProxy('bot');
    expect(restored).toMatchObject({
      source: 'pool',
      protocol: 'socks5h',
      downloadProxied: false,
    });
    expect(select).toHaveBeenCalledWith('bot');
  });
});

describe('InstanceManager persistence and pins', () => {
  let dir: string;
  let store: InstanceStore;

  const build = (overrides: Record<string, unknown> = {}) =>
    new InstanceManager({
      sessionPath: './sessions',
      webhookSecret: 'test-secret',
      webhookTimeout: 1000,
      webhookMaxRetries: 3,
      webhookRetryDelay: 1000,
      store,
      ...overrides,
    } as any);

  beforeEach(() => {
    coreMock.clients.length = 0;
    coreMock.options.length = 0;
    coreMock.calls.length = 0;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'miaw-mgr-'));
    store = new InstanceStore(getInstanceStorePath(dir));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('persists a proxy supplied at creation as a pin', async () => {
    const manager = build();
    await manager.createInstance({
      instanceId: 'bot',
      webhookUrl: 'https://example.test/hook',
      clientOptions: {
        proxy: { url: 'http://proxy.test:8080', username: 'region', password: 'secret' },
      },
    });

    const record = store.list().bot;
    // Credentials fold into the URL exactly as core's buildProxyUrl does.
    expect(record.proxy?.url).toBe('http://region:secret@proxy.test:8080/');
    expect(record.proxy?.updatedAt).toBeTypeOf('string');
    expect(record.webhookUrl).toBe('https://example.test/hook');
    // The pin is the single source of truth; nothing shadows it. An otherwise
    // empty clientOptions is omitted rather than stored as {}.
    expect(record.clientOptions).toBeUndefined();
    expect(manager.getProxy('bot').persisted).toBe(true);
  });

  it('restores instances and their pins without connecting them', async () => {
    await store.upsert('bot', {
      proxy: { url: 'http://proxy.test:8080/' },
      webhookUrl: 'https://example.test/hook',
      webhookEvents: ['ready'],
      clientOptions: { debug: true },
    });

    const manager = build();
    const restored = await manager.restore(store.list());

    expect(restored).toEqual(['bot']);
    expect(coreMock.options[0]).toMatchObject({
      instanceId: 'bot',
      debug: true,
      proxy: 'http://proxy.test:8080/',
    });
    // Reconnecting paired sessions at boot is the caller's explicit decision.
    expect(coreMock.calls).not.toContain('connect');

    const state = manager.getInstance('bot');
    expect(state?.status).toBe('disconnected');
    expect(state?.webhookUrl).toBe('https://example.test/hook');
    expect(state?.proxy).toMatchObject({ source: 'explicit', persisted: true });
  });

  it('skips an unusable record instead of aborting the whole restore', async () => {
    await store.upsert('broken', { proxy: { label: 'nowhere' } });
    await store.upsert('good', { proxy: { url: 'http://proxy.test:8080/' } });

    // No pool configured, so the label cannot resolve.
    const manager = build();
    const restored = await manager.restore(store.list());

    expect(restored).toEqual(['good']);
    expect(manager.getInstance('broken')).toBeNull();
  });

  it('resolves a label pin through the pool and reports its own source', async () => {
    const entry = { url: 'socks5h://eu1.test:1080', label: 'eu', weight: 1 };
    const manager = build({
      proxyPool: { select: vi.fn(), selectByLabel: vi.fn(() => entry) },
    });

    await manager.createInstance({ instanceId: 'bot' });
    const info = await manager.replaceProxy('bot', { label: 'eu' });

    expect(info.source).toBe('pin-label');
    expect(store.list().bot.proxy).toMatchObject({ label: 'eu' });
    // A label stores no credentials at all.
    expect(JSON.stringify(store.list().bot.proxy)).not.toContain('://');
  });

  it('refuses an unresolvable label rather than falling back to a direct connection', async () => {
    const manager = build({
      proxyPool: {
        select: vi.fn(),
        selectByLabel: vi.fn(() => {
          throw new Error('Cannot resolve proxy label "eu": no entry in the proxy pool carries it.');
        }),
      },
    });
    await manager.createInstance({ instanceId: 'bot' });

    await expect(manager.replaceProxy('bot', { label: 'eu' })).rejects.toThrow(
      'Cannot resolve proxy label'
    );
    // The old assignment survives a failed change.
    expect(manager.getProxy('bot').source).toBe('none');
  });

  it('drops the stored pin when a change is not persisted', async () => {
    const manager = build();
    await manager.createInstance({
      instanceId: 'bot',
      clientOptions: { proxy: 'http://first.test:8080' },
    });
    expect(store.list().bot.proxy?.url).toBe('http://first.test:8080/');

    await manager.replaceProxy('bot', 'http://second.test:8080', { persist: false });

    // Leaving the old pin would silently restore the wrong egress on restart.
    expect(store.list().bot.proxy).toBeUndefined();
    expect(manager.getProxy('bot')).toMatchObject({
      url: 'http://second.test:8080/',
      persisted: false,
    });
  });

  it('removes the stored record when the instance is deleted', async () => {
    const manager = build();
    await manager.createInstance({ instanceId: 'bot' });
    expect(store.list()).toHaveProperty('bot');

    await manager.deleteInstance('bot');
    expect(store.list()).not.toHaveProperty('bot');
  });

  it('keeps serving requests when the store cannot be written', async () => {
    const manager = build();
    vi.spyOn(store, 'upsert').mockRejectedValue(new Error('disk full'));

    await expect(manager.createInstance({ instanceId: 'bot' })).resolves.toMatchObject({
      instanceId: 'bot',
    });
    expect(manager.getProxy('bot').persisted).toBe(false);
  });
});
