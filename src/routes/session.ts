/**
 * Session & Lifecycle Routes (Phase 14)
 * DELETE /instances/:instanceId/session - Logout from WhatsApp
 * DELETE /instances/:instanceId/runtime - Dispose and cleanup resources
 * DELETE /instances/:instanceId/authentication - Clear local authentication files
 * GET /instances/:instanceId/stats/messages - Get message counts per chat
 * GET /instances/:instanceId/stats/labels - Get labels store info
 */

import { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth.js';
import { NotFoundError, ServiceUnavailableError } from '../utils/errorHandler.js';

/**
 * Register session lifecycle and stats routes
 */
export async function sessionRoutes(server: FastifyInstance): Promise<void> {
  // All routes require authentication
  server.addHook('onRequest', createAuthMiddleware());

  /**
   * DELETE /instances/:instanceId/session
   * Logout from WhatsApp and clear session
   */
  server.delete(
    '/instances/:instanceId/session',
    {
      schema: {
        description: `Logout from WhatsApp and clear session files.

**What happens:**
- Sends logout notification to WhatsApp servers
- Clears all session/authentication files
- Instance status changes to \`disconnected\`

**After logout:**
- A new QR code scan is required to reconnect
- Previous session cannot be restored`,
        tags: ['Session'],
        summary: 'Logout instance',
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

      try {
        await client.logout();
        reply.send({
          success: true,
          data: { loggedOut: true },
        });
      } catch (err: any) {
        throw new ServiceUnavailableError(err.message);
      }
    }
  );

  /**
   * DELETE /instances/:instanceId/runtime
   * Dispose instance and cleanup resources
   */
  server.delete(
    '/instances/:instanceId/runtime',
    {
      schema: {
        description: `Dispose instance and cleanup all resources.

**What happens:**
- Closes WebSocket connection
- Clears all in-memory data (messages, contacts, etc.)
- Removes event listeners
- Session files are preserved (can reconnect without QR)

**Use case:**
- Graceful shutdown
- Resource cleanup without losing authentication`,
        tags: ['Session'],
        summary: 'Dispose instance',
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

      try {
        await client.dispose();
        reply.send({
          success: true,
          data: { disposed: true },
        });
      } catch (err: any) {
        throw new ServiceUnavailableError(err.message);
      }
    }
  );

  /**
   * DELETE /instances/:instanceId/authentication
   * Clear session files manually
   */
  server.delete(
    '/instances/:instanceId/authentication',
    {
      schema: {
        description: `Clear session files manually.

**What happens:**
- Deletes authentication/session files from disk
- Does NOT disconnect from WhatsApp (use logout for that)

**Use case:**
- Force fresh authentication on next connect
- Clean up corrupted session data`,
        tags: ['Session'],
        summary: 'Clear session',
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

      const cleared = client.clearSession();
      reply.send({
        success: true,
        data: { cleared },
      });
    }
  );

  /**
   * GET /instances/:instanceId/stats/messages
   * Get message counts per chat
   */
  server.get(
    '/instances/:instanceId/stats/messages',
    {
      schema: {
        description: `Get message counts per chat from in-memory store.

**Returns:**
- \`counts\`: Object mapping chat JID to message count
- \`totalChats\`: Number of chats with messages
- \`totalMessages\`: Total messages across all chats

**Note:** Only includes messages stored in memory (history sync data).`,
        tags: ['Stats'],
        summary: 'Get message counts',
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

      const countsMap = client.getMessageCounts();
      const counts = Object.fromEntries(countsMap);
      const totalChats = countsMap.size;
      let totalMessages = 0;
      countsMap.forEach((count: number) => {
        totalMessages += count;
      });

      reply.send({
        success: true,
        data: {
          counts,
          totalChats,
          totalMessages,
        },
      });
    }
  );

  /**
   * GET /instances/:instanceId/stats/labels
   * Get labels store info
   */
  server.get(
    '/instances/:instanceId/stats/labels',
    {
      schema: {
        description: `Get labels store statistics.

**Returns:**
- \`size\`: Number of labels in store
- \`eventCount\`: Number of label edit events received since connection
- \`lastSyncTime\`: Timestamp of last sync (if available)

**Note:** Labels are only available for WhatsApp Business accounts.`,
        tags: ['Stats'],
        summary: 'Get labels store info',
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

      const labelsInfo = client.getLabelsStoreInfo();
      reply.send({
        success: true,
        data: {
          size: labelsInfo.size,
          eventCount: labelsInfo.eventCount,
          lastSyncTime: labelsInfo.lastSyncTime?.toISOString() || null,
        },
      });
    }
  );
}
