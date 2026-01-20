/**
 * Newsletter Management Routes
 * POST /instances/:id/newsletters - Create newsletter
 * DELETE /instances/:id/newsletters/:newsletterId - Delete newsletter
 * GET /instances/:id/newsletters/:newsletterId - Get newsletter metadata
 * GET /instances/:id/newsletters/:newsletterId/messages - Get newsletter messages
 * POST /instances/:id/newsletters/:newsletterId/messages/text - Send text message
 * POST /instances/:id/newsletters/:newsletterId/messages/image - Send image
 * POST /instances/:id/newsletters/:newsletterId/messages/video - Send video
 * POST /instances/:id/newsletters/:newsletterId/follow - Follow newsletter
 * DELETE /instances/:id/newsletters/:newsletterId/follow - Unfollow newsletter
 * POST /instances/:id/newsletters/:newsletterId/mute - Mute newsletter
 * DELETE /instances/:id/newsletters/:newsletterId/mute - Unmute newsletter
 * PATCH /instances/:id/newsletters/:newsletterId/name - Update name
 * PATCH /instances/:id/newsletters/:newsletterId/description - Update description
 * POST /instances/:id/newsletters/:newsletterId/picture - Update picture
 * DELETE /instances/:id/newsletters/:newsletterId/picture - Remove picture
 * POST /instances/:id/newsletters/:newsletterId/messages/:messageId/reaction - React to message
 * POST /instances/:id/newsletters/:newsletterId/subscribe - Subscribe to updates
 * GET /instances/:id/newsletters/:newsletterId/subscribers - Get subscriber info
 * GET /instances/:id/newsletters/:newsletterId/admins/count - Get admin count
 * POST /instances/:id/newsletters/:newsletterId/owner - Transfer ownership
 * DELETE /instances/:id/newsletters/:newsletterId/admins/:adminJid - Demote admin
 */

import { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth';
import { NotFoundError, BadRequestError, ServiceUnavailableError } from '../utils/errorHandler';

/**
 * Register newsletter management routes
 */
export async function newsletterRoutes(server: FastifyInstance): Promise<void> {
  // All routes require authentication
  server.addHook('onRequest', createAuthMiddleware());

  /**
   * GET /instances/:id/newsletters/:newsletterId
   * Get newsletter metadata
   */
  server.get(
    '/instances/:id/newsletters/:newsletterId',
    {
      schema: {
        description: 'Get newsletter/channel metadata',
        tags: ['Newsletters'],
        summary: 'Get newsletter metadata',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            newsletterId: { type: 'string' },
          },
          required: ['id', 'newsletterId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  picture: { type: 'string' },
                  createTime: { type: 'number' },
                  updateTime: { type: 'number' },
                  isOwn: { type: 'boolean' },
                  isSubscribed: { type: 'boolean' },
                  isMuted: { type: 'boolean' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
          503: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string; newsletterId: string };

      const instanceManager = (server as any).instanceManager;
      const client = instanceManager.getClient(params.id);
      const instance = instanceManager.getInstance(params.id);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      try {
        const metadata = await client.getNewsletterMetadata(params.newsletterId);

        reply.send({
          success: true,
          data: metadata,
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to get newsletter metadata', {
          error: err.message,
        });
      }
    }
  );

  /**
   * GET /instances/:id/newsletters/:newsletterId/messages
   * Get newsletter messages
   */
  server.get(
    '/instances/:id/newsletters/:newsletterId/messages',
    {
      schema: {
        description: 'Get messages from a newsletter/channel',
        tags: ['Newsletters'],
        summary: 'Get newsletter messages',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            newsletterId: { type: 'string' },
          },
          required: ['id', 'newsletterId'],
        },
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
            count: { type: 'number', minimum: 1, maximum: 100, default: 10 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        messageId: { type: 'string' },
                        timestamp: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
          503: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string; newsletterId: string };
      const query = request.query as { limit?: number; count?: number };

      const instanceManager = (server as any).instanceManager;
      const client = instanceManager.getClient(params.id);
      const instance = instanceManager.getInstance(params.id);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      try {
        const messages = await client.getNewsletterMessages(
          params.newsletterId,
          query.limit || query.count
        );

        reply.send({
          success: true,
          data: messages,
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to get newsletter messages', {
          error: err.message,
        });
      }
    }
  );
}
