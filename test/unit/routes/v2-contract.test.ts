import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { config } from '../../../src/config/index.js';
import { V2_ROUTE_CONTRACT, REMOVED_V1_ROUTES } from '../../../src/routes/contract.js';
import { createServer } from '../../../src/server.js';

describe('API v2 route contract', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createServer();
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('matches the authoritative protected-route manifest', () => {
    const specification = server.swagger();
    const actual = Object.entries(specification.paths)
      .flatMap(([path, operations]) => Object.keys(operations)
        .filter((method) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
        .map((method) => `${method.toUpperCase()} ${path.replace(/\{([^}]+)\}/g, ':$1')}`))
      .filter((route) => route.includes(' /api/v1/'))
      .sort();
    const expected = V2_ROUTE_CONTRACT.filter((route) => route.includes(' /api/v1/')).sort();

    expect(actual).toEqual(expected);
  });

  it('uses instanceId and has no duplicate wildcard method/path shapes', () => {
    const specification = server.swagger();
    const routes = Object.entries(specification.paths)
      .flatMap(([path, operations]) => Object.keys(operations)
        .filter((method) => ['get', 'post', 'put', 'patch', 'delete'].includes(method))
        .map((method) => `${method.toUpperCase()} ${path}`))
      .filter((route) => route.includes('/api/v1/instances'));
    const shapes = routes.map((route) => route.replace(/\{[^}]+\}/g, '{}'));

    expect(routes.every((route) => !route.includes('{id}'))).toBe(true);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it('keeps only the documented unversioned utility routes', () => {
    expect(server.hasRoute({ method: 'GET', url: '/health' })).toBe(true);
    expect(server.hasRoute({ method: 'GET', url: '/docs' })).toBe(true);
    expect(server.hasRoute({ method: 'GET', url: '/documentation/json' })).toBe(true);
  });

  it('uses the uniform collection envelope and 201 for creation', async () => {
    const headers = { authorization: `Bearer ${config.apiKey}` };
    const listed = await server.inject({ method: 'GET', url: '/api/v1/instances', headers });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      success: true,
      data: { items: expect.any(Array), total: expect.any(Number) },
    });

    const instanceId = `contract-${Date.now()}`;
    const created = await server.inject({
      method: 'POST',
      url: '/api/v1/instances',
      headers,
      payload: { instanceId },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      success: true,
      data: { instanceId },
    });
    expect(created.json().data.success).toBeUndefined();

    await server.inject({
      method: 'DELETE',
      url: `/api/v1/instances/${instanceId}`,
      headers,
    });
  });

  it.each(REMOVED_V1_ROUTES)('returns 404 for removed route %s', async (route) => {
    const [method, path] = route.split(' ', 2);
    const oldUrl = path.replace(/:[^/]+/g, 'test');
    for (const url of [oldUrl, `/api/v1${oldUrl}`]) {
      const response = await server.inject({
        method,
        url,
        headers: { authorization: `Bearer ${config.apiKey}` },
        payload: ['POST', 'PUT', 'PATCH'].includes(method)
          ? route.includes('/messages/edit')
            ? { messageId: 'message', text: 'removed route' }
            : {}
          : undefined,
      });
      expect(response.statusCode).toBe(404);
    }
  });
});
