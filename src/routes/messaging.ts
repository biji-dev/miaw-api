/**
 * Messaging Routes
 * POST /instances/:id/send-text - Send text message
 * POST /instances/:id/send-media - Send media (image, video, audio, document)
 * PATCH /instances/:id/messages/edit - Edit message
 * DELETE /instances/:id/messages/:messageId - Delete message
 * POST /instances/:id/messages/reaction - React to message
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

  /**
   * POST /instances/:id/send-media
   * Send media message (image, video, audio, document)
   */
  server.post(
    '/instances/:id/send-media',
    {
      schema: {
        description: 'Send a media message (image, video, audio, document)',
        tags: ['Messaging'],
        summary: 'Send media message',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          $ref: 'sendMedia#',
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
        media: string;
        caption?: string;
        fileName?: string;
        mimetype?: string;
        viewOnce?: boolean;
        ptt?: boolean;
        gifPlayback?: boolean;
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
        const result = await client.sendMedia(body.to, body.media, {
          caption: body.caption,
          fileName: body.fileName,
          mimetype: body.mimetype,
          viewOnce: body.viewOnce,
          ptt: body.ptt,
          gifPlayback: body.gifPlayback,
          quoted: body.quoted,
        });

        reply.send({
          success: true,
          data: {
            messageId: result.messageId,
            to: body.to,
            timestamp: result.timestamp,
          },
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to send media', { error: err.message });
      }
    }
  );

  /**
   * PATCH /instances/:id/messages/edit
   * Edit a text message
   */
  server.patch(
    '/instances/:id/messages/edit',
    {
      schema: {
        description: 'Edit a previously sent text message',
        tags: ['Messaging'],
        summary: 'Edit message',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          $ref: 'editMessage#',
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
        messageId: string;
        text: string;
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
        const result = await client.editMessage(body.messageId, body.text);

        reply.send({
          success: true,
          data: {
            messageId: result.messageId || body.messageId,
            timestamp: result.timestamp || Date.now(),
          },
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to edit message', { error: err.message });
      }
    }
  );

  /**
   * DELETE /instances/:id/messages/:messageId
   * Delete a message
   */
  server.delete(
    '/instances/:id/messages/:messageId',
    {
      schema: {
        description: 'Delete a message (for everyone or for me)',
        tags: ['Messaging'],
        summary: 'Delete message',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            messageId: { type: 'string' },
          },
          required: ['id', 'messageId'],
        },
        querystring: {
          type: 'object',
          properties: {
            forMe: {
              type: 'boolean',
              default: false,
              description: 'Delete only for me (true) or for everyone (false)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
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
      const params = request.params as { id: string; messageId: string };
      const query = request.query as { forMe?: boolean };

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
        await client.deleteMessage(params.messageId, query.forMe);

        reply.send({
          success: true,
          message: query.forMe
            ? 'Message deleted for me'
            : 'Message deleted for everyone',
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to delete message', { error: err.message });
      }
    }
  );

  /**
   * POST /instances/:id/messages/reaction
   * React to a message with emoji
   */
  server.post(
    '/instances/:id/messages/reaction',
    {
      schema: {
        description: 'React to a message with an emoji (send empty emoji to remove)',
        tags: ['Messaging'],
        summary: 'React to message',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          $ref: 'reactionMessage#',
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
                  emoji: { type: 'string' },
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
      const params = request.params as { id: string };
      const body = request.body as {
        messageId: string;
        emoji: string;
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
        await client.reactMessage(body.messageId, body.emoji);

        reply.send({
          success: true,
          data: {
            messageId: body.messageId,
            emoji: body.emoji || '(removed)',
          },
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to react to message', { error: err.message });
      }
    }
  );
}
