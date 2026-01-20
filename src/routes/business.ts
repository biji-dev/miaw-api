/**
 * Business Features Routes
 * POST /instances/:id/labels - Create label
 * DELETE /instances/:id/labels/:labelId - Delete label
 * POST /instances/:id/chats/:jid/labels/:labelId - Add label to chat
 * DELETE /instances/:id/chats/:jid/labels/:labelId - Remove label from chat
 * POST /instances/:id/messages/:messageId/labels/:labelId - Add label to message
 * DELETE /instances/:id/messages/:messageId/labels/:labelId - Remove label from message
 * GET /instances/:id/products/catalog - Get product catalog
 * GET /instances/:id/products/collections - Get product collections
 * GET /instances/:id/newsletters/:newsletterId - Get newsletter metadata
 * GET /instances/:id/newsletters/:newsletterId/messages - Get newsletter messages
 */

import { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth';
import { NotFoundError, BadRequestError, ServiceUnavailableError } from '../utils/errorHandler';

/**
 * Register business features routes
 */
export async function businessRoutes(server: FastifyInstance): Promise<void> {
  // All routes require authentication
  server.addHook('onRequest', createAuthMiddleware());

  // ===================== LABEL MANAGEMENT =====================

  /**
   * POST /instances/:id/labels
   * Create or edit a label
   */
  server.post(
    '/instances/:id/labels',
    {
      schema: {
        description: 'Create or edit a label (WhatsApp Business only)',
        tags: ['Business'],
        summary: 'Create/edit label',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          required: ['name', 'color'],
          properties: {
            id: { type: 'string', description: 'Label ID (required for edit)' },
            name: { type: 'string', minLength: 1, maxLength: 50 },
            color: { type: 'integer', minimum: 0, maximum: 19 },
            predefinedId: { type: 'string' },
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
                  success: { type: 'boolean' },
                  labelId: { type: 'string' },
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
        id?: string;
        name: string;
        color: number;
        predefinedId?: string;
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
        const result = await client.addLabel({
          id: body.id || '',
          name: body.name,
          color: body.color,
          deleted: false,
          predefinedId: body.predefinedId,
        });

        reply.send({
          success: true,
          data: {
            success: result.success,
            labelId: result.labelId,
          },
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to create label', { error: err.message });
      }
    }
  );

  /**
   * DELETE /instances/:id/labels/:labelId
   * Delete a label
   */
  server.delete(
    '/instances/:id/labels/:labelId',
    {
      schema: {
        description: 'Delete a label (WhatsApp Business only)',
        tags: ['Business'],
        summary: 'Delete label',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            labelId: { type: 'string' },
          },
          required: ['id', 'labelId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
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
      const params = request.params as { id: string; labelId: string };

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
        // Delete by setting deleted flag to true
        const result = await client.addLabel({
          id: params.labelId,
          name: '',
          color: 0,
          deleted: true,
        });

        reply.send({
          success: true,
          data: {
            success: result.success,
          },
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to delete label', { error: err.message });
      }
    }
  );

  /**
   * POST /instances/:id/chats/:jid/labels/:labelId
   * Add label to chat
   */
  server.post(
    '/instances/:id/chats/:jid/labels/:labelId',
    {
      schema: {
        description: 'Add a label to a chat (WhatsApp Business only)',
        tags: ['Business'],
        summary: 'Add label to chat',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            jid: { type: 'string' },
            labelId: { type: 'string' },
          },
          required: ['id', 'jid', 'labelId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
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
      const params = request.params as { id: string; jid: string; labelId: string };

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
        const result = await client.addChatLabel(params.jid, params.labelId);

        reply.send({
          success: true,
          data: {
            success: result.success,
          },
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to add label to chat', { error: err.message });
      }
    }
  );

  /**
   * DELETE /instances/:id/chats/:jid/labels/:labelId
   * Remove label from chat
   */
  server.delete(
    '/instances/:id/chats/:jid/labels/:labelId',
    {
      schema: {
        description: 'Remove a label from a chat (WhatsApp Business only)',
        tags: ['Business'],
        summary: 'Remove label from chat',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            jid: { type: 'string' },
            labelId: { type: 'string' },
          },
          required: ['id', 'jid', 'labelId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
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
      const params = request.params as { id: string; jid: string; labelId: string };

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
        const result = await client.removeChatLabel(params.jid, params.labelId);

        reply.send({
          success: true,
          data: {
            success: result.success,
          },
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to remove label from chat', {
          error: err.message,
        });
      }
    }
  );

  /**
   * POST /instances/:id/messages/:messageId/labels/:labelId
   * Add label to message
   */
  server.post(
    '/instances/:id/messages/:messageId/labels/:labelId',
    {
      schema: {
        description: 'Add a label to a message (WhatsApp Business only)',
        tags: ['Business'],
        summary: 'Add label to message',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            messageId: { type: 'string' },
            labelId: { type: 'string' },
          },
          required: ['id', 'messageId', 'labelId'],
        },
        body: {
          type: 'object',
          required: ['jid'],
          properties: {
            jid: { type: 'string', description: 'Chat JID where the message is' },
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
                  success: { type: 'boolean' },
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
      const params = request.params as { id: string; messageId: string; labelId: string };
      const body = request.body as { jid: string };

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
        const result = await client.addMessageLabel(body.jid, params.messageId, params.labelId);

        reply.send({
          success: true,
          data: {
            success: result.success,
          },
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to add label to message', {
          error: err.message,
        });
      }
    }
  );

  /**
   * DELETE /instances/:id/messages/:messageId/labels/:labelId
   * Remove label from message
   */
  server.delete(
    '/instances/:id/messages/:messageId/labels/:labelId',
    {
      schema: {
        description: 'Remove a label from a message (WhatsApp Business only)',
        tags: ['Business'],
        summary: 'Remove label from message',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            messageId: { type: 'string' },
            labelId: { type: 'string' },
          },
          required: ['id', 'messageId', 'labelId'],
        },
        body: {
          type: 'object',
          required: ['jid'],
          properties: {
            jid: { type: 'string', description: 'Chat JID where the message is' },
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
                  success: { type: 'boolean' },
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
      const params = request.params as { id: string; messageId: string; labelId: string };
      const body = request.body as { jid: string };

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
        const result = await client.removeMessageLabel(body.jid, params.messageId, params.labelId);

        reply.send({
          success: true,
          data: {
            success: result.success,
          },
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to remove label from message', {
          error: err.message,
        });
      }
    }
  );

  // ===================== PRODUCT CATALOG =====================

  /**
   * GET /instances/:id/products/catalog
   * Get product catalog
   */
  server.get(
    '/instances/:id/products/catalog',
    {
      schema: {
        description: 'Get product catalog from a WhatsApp Business account',
        tags: ['Business'],
        summary: 'Get product catalog',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: {
            businessJid: { type: 'string', description: 'Business JID (default: your own)' },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
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
                  isCatalog: { type: 'boolean' },
                  limit: { type: 'number' },
                  products: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        price: { type: 'number' },
                        images: { type: 'array' },
                        url: { type: 'string' },
                        retailerId: { type: 'string' },
                        count: { type: 'number' },
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
      const params = request.params as { id: string };
      const query = request.query as { businessJid?: string; limit?: number };

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
        const catalog = await client.getProductCatalog(query.businessJid, query.limit);

        reply.send({
          success: true,
          data: catalog,
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to get product catalog', { error: err.message });
      }
    }
  );

  /**
   * GET /instances/:id/products/collections
   * Get product collections
   */
  server.get(
    '/instances/:id/products/collections',
    {
      schema: {
        description: 'Get product collections from a WhatsApp Business account',
        tags: ['Business'],
        summary: 'Get product collections',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: {
            businessJid: { type: 'string', description: 'Business JID (default: your own)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    products: {
                      type: 'array',
                      items: {
                        type: 'object',
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
      const params = request.params as { id: string };
      const query = request.query as { businessJid?: string };

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
        const collections = await client.getProductCollections(query.businessJid);

        reply.send({
          success: true,
          data: collections,
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to get product collections', {
          error: err.message,
        });
      }
    }
  );

  // Newsletter endpoints moved to src/routes/newsletters.ts (Phase 12)
}
