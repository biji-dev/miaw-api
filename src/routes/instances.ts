/**
 * Instance Management Routes
 * POST /instances - Create new instance
 * GET /instances - List all instances
 * GET /instances/:instanceId - Get instance details
 * DELETE /instances/:instanceId - Delete instance
 */

import { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth.js';
import { ConflictError, NotFoundError } from '../utils/errorHandler.js';
import type { InstanceClientOptions, WebhookEvent } from '../types/index.js';

/**
 * Register instance routes
 */
export async function instanceRoutes(server: FastifyInstance): Promise<void> {
  // All routes require authentication
  server.addHook('onRequest', createAuthMiddleware());

  /**
   * POST /instances
   * Create a new WhatsApp instance
   */
  server.post(
    '/instances',
    {
      schema: {
        description: 'Create a new WhatsApp instance',
        tags: ['Instances'],
        summary: 'Create instance',
        body: {
          $ref: 'createInstance#',
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        instanceId: string;
        webhookUrl?: string;
        webhookEvents?: WebhookEvent[];
        clientOptions?: InstanceClientOptions;
      };

      const instanceManager = server.instanceManager;

      try {
        const state = await instanceManager.createInstance(body);
        reply.status(201).send({
          success: true,
          data: state,
        });
      } catch (err: any) {
        if (err.message?.includes('already exists')) {
          throw new ConflictError(`Instance ${body.instanceId} already exists`);
        }
        throw err;
      }
    }
  );

  /**
   * GET /instances
   * List all instances
   */
  server.get(
    '/instances',
    {
      schema: {
        description: 'List all WhatsApp instances',
        tags: ['Instances'],
        summary: 'List instances',
      },
    },
    async (_request, reply) => {
      const instanceManager = server.instanceManager;
      const instances = instanceManager.listInstances();

      reply.send({
        success: true,
        data: { items: instances, total: instances.length },
      });
    }
  );

  /**
   * GET /instances/:instanceId
   * Get instance details
   */
  server.get(
    '/instances/:instanceId',
    {
      schema: {
        description: 'Get instance details',
        tags: ['Instances'],
        summary: 'Get instance',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
          },
          required: ['instanceId'],
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string };
      const instanceManager = server.instanceManager;
      const instance = instanceManager.getInstance(params.instanceId);

      if (!instance) {
        throw new NotFoundError('Instance');
      }

      reply.send({
        success: true,
        data: instance,
      });
    }
  );

  /**
   * PATCH /instances/:instanceId/webhook
   * Update instance webhook settings without recreating it
   */
  server.patch(
    '/instances/:instanceId/webhook',
    {
      schema: {
        description: 'Update instance webhook settings (URL and/or events)',
        tags: ['Instances'],
        summary: 'Update instance',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
          },
          required: ['instanceId'],
        },
        body: {
          $ref: 'updateInstance#',
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string };
      const body = request.body as {
        webhookUrl?: string | null;
        webhookEvents?: WebhookEvent[];
      };
      const instanceManager = server.instanceManager;

      try {
        const state = instanceManager.updateWebhook(params.instanceId, body);
        reply.send({
          success: true,
          data: state,
        });
      } catch (err: any) {
        if (err.message?.includes('not found')) {
          throw new NotFoundError('Instance');
        }
        throw err;
      }
    }
  );

  /**
   * DELETE /instances/:instanceId
   * Delete instance
   */
  server.delete(
    '/instances/:instanceId',
    {
      schema: {
        description: 'Delete a WhatsApp instance',
        tags: ['Instances'],
        summary: 'Delete instance',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
          },
          required: ['instanceId'],
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string };
      const instanceManager = server.instanceManager;

      try {
        await instanceManager.deleteInstance(params.instanceId);
        reply.send({
          success: true,
          data: { deleted: true },
        });
      } catch (err: any) {
        if (err.message?.includes('not found')) {
          throw new NotFoundError('Instance');
        }
        throw err;
      }
    }
  );

  for (const challengeType of ['qr', 'pairing_code'] as const) {
    const pathType = challengeType === 'qr' ? 'qr-code' : 'pairing-code';
    server.get(`/instances/:instanceId/authentication/${pathType}`, {
      schema: {
        tags: ['Instances'],
        summary: `Get current ${pathType}`,
        params: {
          type: 'object',
          required: ['instanceId'],
          properties: { instanceId: { type: 'string' } },
        },
      },
    }, async (request, reply) => {
      const { instanceId: id } = request.params as { instanceId: string };
      let value: string | null;
      try {
        value = server.instanceManager.getAuthChallenge(id, challengeType);
      } catch {
        throw new NotFoundError('Instance');
      }
      if (!value) throw new NotFoundError(pathType === 'qr-code' ? 'QR code' : 'Pairing code');
      reply.send({ success: true, data: { [challengeType === 'qr' ? 'qr' : 'code']: value } });
    });
  }
}
