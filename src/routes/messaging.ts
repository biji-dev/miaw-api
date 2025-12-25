/**
 * Messaging Routes
 * POST /instances/:id/send-text - Send text message
 */

import { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth';
import { NotFoundError, BadRequestError, ServiceUnavailableError } from '../utils/errorHandler';

/**
 * Register messaging routes
 */
export async function messagingRoutes(server: FastifyInstance): Promise<void> {
  // All routes require authentication
  server.addHook('onRequest', createAuthMiddleware());

  /**
   * POST /instances/:id/send-text
   * Send text message
   */
  server.post(
    '/instances/:id/send-text',
    {
      schema: {
        description: 'Send a text message',
        tags: ['Messaging'],
        summary: 'Send text message',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          $ref: 'sendText#',
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  messageId: { type: 'string' },
                  to: { type: 'string' },
                  timestamp: { type: 'number' },
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
                  details: { type: 'object' },
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
      const params = request.params as { id: string };
      const body = request.body as {
        to: string;
        text: string;
        quoted?: string;
      };

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
        const result = await client.sendText(body.to, body.text, body.quoted);

        reply.send({
          success: true,
          data: {
            messageId: result.messageId,
            to: body.to,
            timestamp: result.timestamp,
          },
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to send message', { error: err.message });
      }
    }
  );
}
