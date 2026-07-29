/**
 * Unit tests for InstanceManager service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const coreMock = vi.hoisted(() => ({ clients: [] as any[], options: [] as any[] }));

// Mock miaw-core so createInstance does not spin up a real WhatsApp client
vi.mock('miaw-core', () => {
  class MiawClient {
    handlers = new Map<string, (...args: any[]) => void>();
    on = vi.fn((event: string, handler: (...args: any[]) => void) => {
      this.handlers.set(event, handler);
      return this;
    });
    removeAllListeners = vi.fn();
    disconnect = vi.fn();
    getOwnProfile = vi.fn(async () => ({ phone: '6281' }));
    constructor(opts: unknown) {
      coreMock.clients.push(this);
      coreMock.options.push(opts);
    }
    emitTest(event: string, ...args: any[]) { this.handlers.get(event)?.(...args); }
  }
  return { MiawClient };
});

import { InstanceManager } from '../../../src/services/InstanceManager.js';

describe('InstanceManager.updateWebhook', () => {
  let manager: InstanceManager;

  beforeEach(() => {
    coreMock.clients.length = 0;
    coreMock.options.length = 0;
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
});
