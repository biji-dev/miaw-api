/**
 * Unit tests for the connection routes.
 *
 * The load-bearing case is the first one: connect has always been callable with
 * no body at all, and adding an optional body must not break that.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../../src/config/index.js';
import { registerSchemas } from '../../../src/schemas/index.js';

const probeMock = vi.hoisted(() => vi.fn());
vi.mock('../../../src/services/ProxyService.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('../../../src/services/ProxyService.js')
  >();
  return { ...original, testProxy: probeMock };
});

import { connectionRoutes } from '../../../src/routes/connection.js';

describe('connection routes', () => {
  let server: FastifyInstance;
  let client: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> };
  let manager: {
    getClient: ReturnType<typeof vi.fn>;
    getInstance: ReturnType<typeof vi.fn>;
    replaceProxy: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    client = { connect: vi.fn(async () => undefined), disconnect: vi.fn(async () => undefined) };
    manager = {
      getClient: vi.fn(() => client),
      getInstance: vi.fn(() => ({ instanceId: 'bot', status: 'disconnected' })),
      replaceProxy: vi.fn(async () => ({
        source: 'explicit',
        url: 'http://region:****@proxy.test:8080/',
        protocol: 'http',
        downloadProxied: true,
        active: false,
        appliesOnNextConnect: true,
        persisted: true,
        liveProxy: null,
      })),
    };
    probeMock.mockResolvedValue({
      proxy: { url: 'http://proxy.test:8080/', protocol: 'http' },
      reachable: true,
      latencyMs: 12,
      statusCode: 200,
      downloadProxied: true,
      error: null,
    });

    server = Fastify({ logger: false });
    server.decorate('instanceManager', manager as any);
    registerSchemas(server);
    await server.register(connectionRoutes, { prefix: '/api/v1' });
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    vi.clearAllMocks();
  });

  const auth = { authorization: `Bearer ${config.apiKey}` };

  it('connects with no body and no content-type, as callers have always done', async () => {
    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/instances/bot/connection',
      headers: auth,
    });

    expect(response.statusCode).toBe(200);
    expect(client.connect).toHaveBeenCalledOnce();
    expect(manager.replaceProxy).not.toHaveBeenCalled();
  });

  it('connects with an empty JSON body', async () => {
    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/instances/bot/connection',
      headers: auth,
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(manager.replaceProxy).not.toHaveBeenCalled();
  });

  it('applies a proxy before connecting, so pairing uses the final egress IP', async () => {
    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/instances/bot/connection',
      headers: auth,
      payload: { proxy: 'socks5h://proxy.test:1080' },
    });

    expect(response.statusCode).toBe(200);
    expect(manager.replaceProxy).toHaveBeenCalledWith(
      'bot',
      'socks5h://proxy.test:1080',
      { force: false, persist: true }
    );
    expect(manager.replaceProxy.mock.invocationCallOrder[0]).toBeLessThan(
      client.connect.mock.invocationCallOrder[0]
    );
  });

  it('accepts a credential-free pool label', async () => {
    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/instances/bot/connection',
      headers: auth,
      payload: { proxy: { label: 'eu' } },
    });

    expect(response.statusCode).toBe(200);
    expect(manager.replaceProxy).toHaveBeenCalledWith('bot', { label: 'eu' }, {
      force: false,
      persist: true,
    });
  });

  it('clears the assignment when proxy is null', async () => {
    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/instances/bot/connection',
      headers: auth,
      payload: { proxy: null },
    });

    expect(response.statusCode).toBe(200);
    expect(manager.replaceProxy).toHaveBeenCalledWith('bot', null, {
      force: false,
      persist: true,
    });
  });

  it('treats an empty proxy string as a clear, not as an invalid URL', async () => {
    // Guards the AJV coerceTypes trap: null becomes "" if the schema's string
    // branch is tried before its null branch.
    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/instances/bot/connection',
      headers: auth,
      payload: { proxy: '' },
    });

    expect(response.statusCode).toBe(200);
    expect(manager.replaceProxy).toHaveBeenCalledWith('bot', null, {
      force: false,
      persist: true,
    });
  });

  it('rejects an unreachable proxy before touching the instance when asked to validate', async () => {
    probeMock.mockResolvedValueOnce({
      proxy: { url: 'http://proxy.test:8080/', protocol: 'http' },
      reachable: false,
      latencyMs: null,
      statusCode: null,
      downloadProxied: true,
      error: { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' },
    });

    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/instances/bot/connection',
      headers: auth,
      payload: { proxy: 'http://proxy.test:8080', validate: true },
    });

    expect(response.statusCode).toBe(400);
    expect(manager.replaceProxy).not.toHaveBeenCalled();
    expect(client.connect).not.toHaveBeenCalled();
  });

  it('does not probe unless asked', async () => {
    await server.inject({
      method: 'PUT',
      url: '/api/v1/instances/bot/connection',
      headers: auth,
      payload: { proxy: 'http://proxy.test:8080' },
    });
    expect(probeMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid proxy without connecting', async () => {
    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/instances/bot/connection',
      headers: auth,
      payload: { proxy: 'ftp://proxy.test:21' },
    });

    expect(response.statusCode).toBe(400);
    expect(client.connect).not.toHaveBeenCalled();
  });

  it('surfaces a live-instance conflict as 409', async () => {
    manager.replaceProxy.mockRejectedValueOnce(
      new Error('Instance must be disconnected before changing its proxy')
    );

    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/instances/bot/connection',
      headers: auth,
      payload: { proxy: 'http://proxy.test:8080' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('restarts with no body, and applies a proxy while disconnected', async () => {
    const plain = await server.inject({
      method: 'POST',
      url: '/api/v1/instances/bot/connection-restarts',
      headers: auth,
    });
    expect(plain.statusCode).toBe(200);
    expect(manager.replaceProxy).not.toHaveBeenCalled();

    const withProxy = await server.inject({
      method: 'POST',
      url: '/api/v1/instances/bot/connection-restarts',
      headers: auth,
      payload: { proxy: 'http://proxy.test:8080' },
    });
    expect(withProxy.statusCode).toBe(200);
    // Disconnected first, so no force is needed to swap.
    expect(client.disconnect.mock.invocationCallOrder[1]).toBeLessThan(
      manager.replaceProxy.mock.invocationCallOrder[0]
    );
  });

  it('never echoes a proxy password', async () => {
    const response = await server.inject({
      method: 'PUT',
      url: '/api/v1/instances/bot/connection',
      headers: auth,
      payload: {
        proxy: { url: 'http://proxy.test:8080', username: 'region', password: 'secret' },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.payload).not.toContain('secret');
  });
});
