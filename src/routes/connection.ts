/**
 * Connection Routes
 * PUT /instances/:instanceId/connection - Connect instance
 * DELETE /instances/:instanceId/connection - Disconnect instance
 * POST /instances/:instanceId/connection-restarts - Restart instance
 * GET /instances/:instanceId/connection - Get connection status
 */

import { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth.js';
import { NotFoundError, ServiceUnavailableError } from '../utils/errorHandler.js';

/**
 * Register connection routes
 */
export async function connectionRoutes(server: FastifyInstance): Promise<void> {
  // All routes require authentication
  server.addHook('onRequest', createAuthMiddleware());

  /**
   * PUT /instances/:instanceId/connection
   * Connect instance to WhatsApp
   */
  server.put(
    '/instances/:instanceId/connection',
    {
      schema: {
        description: 'Connect instance to WhatsApp (returns QR code if needed). Scan the QR code with WhatsApp to authenticate. Listen to webhooks for the QR code.',
        tags: ['Connection'],
        summary: 'Connect instance',
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
      const client = instanceManager.getClient(params.instanceId);

      if (!client) {
        throw new NotFoundError('Instance');
      }

      const instance = instanceManager.getInstance(params.instanceId);

      try {
        await client.connect();

        // Check current status
        const currentState = instance?.status;

        if (currentState === 'connected') {
          reply.send({
            success: true,
            data: { status: 'connected' },
          });
        } else if (currentState === 'qr_required') {
          // Get QR from latest event
          reply.send({
            success: true,
            data: {
              status: 'qr_required',
              qr: 'Scan QR code with WhatsApp (check webhook for QR)',
            },
          });
        } else {
          reply.send({
            success: true,
            data: { status: 'connecting' },
          });
        }
      } catch (err: any) {
        throw new ServiceUnavailableError(err.message);
      }
    }
  );

  /**
   * DELETE /instances/:instanceId/connection
   * Disconnect instance from WhatsApp
   */
  server.delete(
    '/instances/:instanceId/connection',
    {
      schema: {
        description: 'Disconnect instance from WhatsApp. You can reconnect later using the connect endpoint.',
        tags: ['Connection'],
        summary: 'Disconnect instance',
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
      const client = instanceManager.getClient(params.instanceId);

      if (!client) {
        throw new NotFoundError('Instance');
      }

      await client.disconnect();

      reply.send({
        success: true,
        data: { connected: false },
      });
    }
  );

  /**
   * POST /instances/:instanceId/connection-restarts
   * Restart instance connection
   */
  server.post(
    '/instances/:instanceId/connection-restarts',
    {
      schema: {
        description: 'Restart instance connection. Useful when the connection is stale or having issues.',
        tags: ['Connection'],
        summary: 'Restart instance',
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
      const client = instanceManager.getClient(params.instanceId);

      if (!client) {
        throw new NotFoundError('Instance');
      }

      // Disconnect first if connected
      try {
        await client.disconnect();
      } catch {
        // Ignore disconnect errors
      }

      // Reconnect
      await client.connect();

      reply.send({
        success: true,
        data: { restarted: true },
      });
    }
  );

  /**
   * GET /instances/:instanceId/connection
   * Get connection status
   */
  server.get(
    '/instances/:instanceId/connection',
    {
      schema: {
        description: `Get instance connection status.

**Possible statuses:**
- \`disconnected\`: Not connected to WhatsApp
- \`connecting\`: Connection in progress
- \`connected\`: Successfully connected
- \`reconnecting\`: Reconnection in progress (after connection loss)
- \`qr_required\`: QR code needs to be scanned`,
        tags: ['Connection'],
        summary: 'Get instance status',
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
        data: {
          instanceId: instance.instanceId,
          status: instance.status,
          phoneNumber: instance.phoneNumber,
          connectedAt: instance.connectedAt,
        },
      });
    }
  );
}
