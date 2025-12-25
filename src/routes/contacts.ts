/**
 * Contact & Validation Routes
 * POST /instances/:id/check-number - Check if phone number is on WhatsApp
 * POST /instances/:id/check-batch - Batch check multiple numbers
 * GET /instances/:id/contacts/:jid - Get contact info
 * GET /instances/:id/contacts/:jid/picture - Get profile picture URL
 */

import { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth';
import { NotFoundError, BadRequestError, ServiceUnavailableError } from '../utils/errorHandler';

/**
 * Register contact routes
 */
export async function contactRoutes(server: FastifyInstance): Promise<void> {
  // All routes require authentication
  server.addHook('onRequest', createAuthMiddleware());

  /**
   * POST /instances/:id/check-number
   * Check if phone number is on WhatsApp
   */
  server.post(
    '/instances/:id/check-number',
    {
      schema: {
        description: 'Check if a phone number is on WhatsApp',
        tags: ['Contacts'],
        summary: 'Check phone number',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          $ref: 'checkNumber#',
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  exists: { type: 'boolean' },
                  jid: { type: 'string', nullable: true },
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
      const body = request.body as { phone: string };

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
        const result = await client.checkNumber(body.phone);

        reply.send({
          success: true,
          data: {
            exists: result.exists ?? false,
            jid: result.jid ?? null,
          },
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to check number', { error: err.message });
      }
    }
  );

  /**
   * POST /instances/:id/check-batch
   * Batch check multiple phone numbers
   */
  server.post(
    '/instances/:id/check-batch',
    {
      schema: {
        description: 'Check multiple phone numbers on WhatsApp (up to 50)',
        tags: ['Contacts'],
        summary: 'Batch check phone numbers',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          $ref: 'checkBatch#',
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
                    phone: { type: 'string' },
                    exists: { type: 'boolean' },
                    jid: { type: 'string', nullable: true },
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
      const body = request.body as { phones: string[] };

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
        const results = await client.checkNumbers(body.phones);

        reply.send({
          success: true,
          data: results,
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to check numbers', { error: err.message });
      }
    }
  );

  /**
   * GET /instances/:id/contacts/:jid
   * Get contact information
   */
  server.get(
    '/instances/:id/contacts/:jid',
    {
      schema: {
        description: 'Get contact information by JID',
        tags: ['Contacts'],
        summary: 'Get contact info',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            jid: { type: 'string' },
          },
          required: ['id', 'jid'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  jid: { type: 'string' },
                  name: { type: 'string', nullable: true },
                  notify: { type: 'string', nullable: true },
                  verifiedName: { type: 'string', nullable: true },
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
      const params = request.params as { id: string; jid: string };

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
        const contactInfo = await client.getContactInfo(params.jid);

        reply.send({
          success: true,
          data: contactInfo,
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to get contact info', { error: err.message });
      }
    }
  );

  /**
   * GET /instances/:id/contacts/:jid/picture
   * Get profile picture URL
   */
  server.get(
    '/instances/:id/contacts/:jid/picture',
    {
      schema: {
        description: 'Get profile picture URL for a contact',
        tags: ['Contacts'],
        summary: 'Get profile picture',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            jid: { type: 'string' },
          },
          required: ['id', 'jid'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  url: { type: 'string', nullable: true },
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
      const params = request.params as { id: string; jid: string };

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
        const pictureUrl = await client.getProfilePictureUrl(params.jid);

        reply.send({
          success: true,
          data: {
            url: pictureUrl,
          },
        });
      } catch (err: any) {
        throw new BadRequestError('Failed to get profile picture', { error: err.message });
      }
    }
  );
}
