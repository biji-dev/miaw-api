import type { FastifyInstance } from 'fastify';
import { validateProxyConfig } from 'miaw-core';
import { createAuthMiddleware } from '../middleware/auth.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
} from '../utils/errorHandler.js';
import {
  assertProxyReachable,
  testProxy,
  type ProxyInput,
} from '../services/ProxyService.js';
import type { EffectiveProxyInfo, ProxyAssignment } from '../types/index.js';

const instanceParams = {
  type: 'object',
  required: ['instanceId'],
  properties: {
    instanceId: { type: 'string' },
  },
};

/** Body shared by the proxy endpoints and the connect endpoints. */
export interface ProxyMutationBody {
  proxy?: ProxyAssignment | null;
  validate?: boolean;
  force?: boolean;
  persist?: boolean;
  timeoutMs?: number;
}

/**
 * Validate, optionally probe, then apply a proxy assignment to an instance.
 *
 * Shared so `PUT /proxy` and the connect endpoints cannot drift apart on
 * validation, masking or error mapping.
 */
export async function applyProxyMutation(
  server: FastifyInstance,
  instanceId: string,
  body: ProxyMutationBody
): Promise<EffectiveProxyInfo> {
  // Fastify runs AJV with coerceTypes, which turns null into "" if the string
  // branch of proxyConfig is tried first. The schema orders the null branch to
  // prevent that; this keeps a clear working even if that ordering is lost.
  const proxy = body.proxy === '' ? null : body.proxy;

  if (proxy !== undefined && proxy !== null) {
    const isLabel = typeof proxy === 'object' && 'label' in proxy;
    if (!isLabel && !validateProxyConfig(proxy as ProxyInput)) {
      throw new BadRequestError('Invalid proxy configuration');
    }
    // A label has no URL to probe until the pool resolves it, which happens
    // inside the manager - so only URL forms are probed here.
    if (body.validate && !isLabel) {
      try {
        await assertProxyReachable(proxy as ProxyInput, body.timeoutMs);
      } catch (error) {
        throw new BadRequestError(
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  try {
    return await server.instanceManager.replaceProxy(instanceId, proxy, {
      force: body.force ?? false,
      persist: body.persist ?? true,
    });
  } catch (error) {
    throw mapInstanceProxyError(error);
  }
}

export async function proxyRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.get('/proxy-pool', {
    schema: {
      tags: ['Proxies'],
      summary: 'Inspect the configured proxy pool',
    },
  }, async () => ({
    success: true,
    data: server.proxyPool.getStatus(),
  }));

  server.post('/proxy-pool/reloads', {
    schema: {
      tags: ['Proxies'],
      summary: 'Reload the configured proxy pool',
    },
  }, async () => {
    if (!server.proxyPool.enabled) {
      throw new ConflictError('Proxy pool is not configured');
    }

    try {
      return {
        success: true,
        data: await server.proxyPool.reload(),
      };
    } catch (error) {
      server.log.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'On-demand proxy pool reload failed'
      );
      throw new ServiceUnavailableError(
        'Proxy pool reload failed; the previous pool remains active'
      );
    }
  });

  server.post('/proxy-tests', {
    schema: {
      tags: ['Proxies'],
      summary: 'Test a proxy without creating an instance',
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['proxy'],
        properties: {
          proxy: { $ref: 'proxyConfig#' },
          timeoutMs: {
            type: 'integer',
            minimum: 1000,
            maximum: 30000,
            default: 10000,
          },
        },
      },
    },
  }, async (request) => {
    const body = request.body as {
      proxy: ProxyInput;
      timeoutMs?: number;
    };
    if (!validateProxyConfig(body.proxy)) {
      throw new BadRequestError('Invalid proxy configuration');
    }
    return {
      success: true,
      data: await testProxy(body.proxy, body.timeoutMs),
    };
  });

  server.get('/instances/:instanceId/proxy', {
    schema: {
      tags: ['Proxies'],
      summary: 'Get an instance proxy',
      params: instanceParams,
    },
  }, async (request) => {
    const { instanceId } = request.params as { instanceId: string };
    try {
      return {
        success: true,
        data: server.instanceManager.getProxy(instanceId),
      };
    } catch (error) {
      throw mapInstanceProxyError(error);
    }
  });

  server.put('/instances/:instanceId/proxy', {
    schema: {
      tags: ['Proxies'],
      summary: 'Set an instance proxy',
      description:
        'Sets the egress for one instance. The instance must be disconnected ' +
        'unless `force` is set, because changing a live session\'s IP is read ' +
        'by WhatsApp as account takeover. Accepts a URL, a ProxyConfig, or a ' +
        '`{ label }` reference to the proxy pool, which stores no credentials.',
      params: instanceParams,
      body: {
        allOf: [
          { $ref: 'proxyMutation#' },
          // `type` is required alongside `required` under AJV strict mode.
          { type: 'object', required: ['proxy'] },
        ],
      },
    },
  }, async (request) => ({
    success: true,
    data: await applyProxyMutation(
      server,
      (request.params as { instanceId: string }).instanceId,
      request.body as ProxyMutationBody
    ),
  }));

  server.delete('/instances/:instanceId/proxy', {
    schema: {
      tags: ['Proxies'],
      summary: 'Remove an instance proxy override',
      params: instanceParams,
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: { force: { type: 'boolean', default: false } },
      },
    },
  }, async (request) => {
    const { instanceId } = request.params as { instanceId: string };
    const { force } = request.query as { force?: boolean };
    return {
      success: true,
      data: await applyProxyMutation(server, instanceId, { proxy: null, force }),
    };
  });
}

function mapInstanceProxyError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('not found')) return new NotFoundError('Instance');
  if (message.includes('must be disconnected')) {
    return new ConflictError(message);
  }
  if (message.includes('Invalid proxy configuration')) {
    return new BadRequestError('Invalid proxy configuration');
  }
  return error instanceof Error ? error : new Error(message);
}
