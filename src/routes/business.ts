import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getConnectedClient, requireCoreSuccess } from '../utils/client.js';

const instanceParams = {
  type: 'object',
  required: ['instanceId'],
  properties: { instanceId: { type: 'string' } },
};

const productBody = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    price: { type: 'number', minimum: 0 },
    currency: { type: 'string', pattern: '^[A-Z]{3}$' },
    imageUrls: { type: 'array', items: { type: 'string', pattern: '^https?://' } },
    isHidden: { type: 'boolean' },
    retailerId: { type: 'string' },
    url: { type: 'string' },
    originCountryCode: { type: 'string' },
  },
};

export async function businessRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  const saveLabel = async (
    request: FastifyRequest,
    labelId: string
  ) => {
    const { instanceId } = request.params as { instanceId: string };
    const body = request.body as { name: string; color: number; predefinedId?: string };
    const client = getConnectedClient(server, instanceId);
    const result = await client.addLabel({
      id: labelId,
      name: body.name,
      color: body.color,
      deleted: false,
      predefinedId: body.predefinedId,
    } as Parameters<typeof client.addLabel>[0]);
    requireCoreSuccess(result, labelId ? 'Update label' : 'Create label');
    return { success: true, data: { labelId: result.labelId } };
  };

  server.post('/instances/:instanceId/labels', {
    schema: {
      tags: ['Business'],
      summary: 'Create label',
      params: instanceParams,
      body: {
        type: 'object',
        required: ['name', 'color'],
        properties: {
          name: { type: 'string', minLength: 1 },
          color: { type: 'integer', minimum: 0, maximum: 19 },
          predefinedId: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => reply.status(201).send(await saveLabel(request, '')));

  server.patch('/instances/:instanceId/labels/:labelId', {
    schema: {
      tags: ['Business'],
      summary: 'Update label',
      params: {
        type: 'object',
        required: ['instanceId', 'labelId'],
        properties: { instanceId: { type: 'string' }, labelId: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['name', 'color'],
        properties: {
          name: { type: 'string', minLength: 1 },
          color: { type: 'integer', minimum: 0, maximum: 19 },
          predefinedId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { labelId } = request.params as { labelId: string };
    return saveLabel(request, labelId);
  });

  server.delete('/instances/:instanceId/labels/:labelId', {
    schema: {
      tags: ['Business'],
      summary: 'Delete label',
      params: {
        type: 'object',
        required: ['instanceId', 'labelId'],
        properties: { instanceId: { type: 'string' }, labelId: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { instanceId, labelId } = request.params as { instanceId: string; labelId: string };
    const client = getConnectedClient(server, instanceId);
    const result = await client.addLabel({ id: labelId, name: '', color: 0, deleted: true } as Parameters<typeof client.addLabel>[0]);
    requireCoreSuccess(result, 'Delete label');
    return { success: true, data: { labelId, removed: true } };
  });

  for (const method of ['PUT', 'DELETE'] as const) {
    server.route({
      method,
      url: '/instances/:instanceId/chats/:chatJid/labels/:labelId',
      schema: { tags: ['Business'], summary: `${method === 'PUT' ? 'Assign' : 'Unassign'} chat label` },
      handler: async (request) => {
        const { instanceId, chatJid, labelId } = request.params as {
          instanceId: string;
          chatJid: string;
          labelId: string;
        };
        const client = getConnectedClient(server, instanceId);
        const result = method === 'PUT'
          ? await client.addChatLabel(chatJid, labelId)
          : await client.removeChatLabel(chatJid, labelId);
        return { success: true, data: requireCoreSuccess(result, `${method} chat label`) };
      },
    });

    server.route({
      method,
      url: '/instances/:instanceId/messages/:messageId/labels/:labelId',
      schema: {
        tags: ['Business'],
        summary: `${method === 'PUT' ? 'Assign' : 'Unassign'} message label`,
        querystring: {
          type: 'object',
          required: ['chatJid'],
          properties: { chatJid: { type: 'string' } },
        },
      },
      handler: async (request) => {
        const { instanceId, messageId, labelId } = request.params as {
          instanceId: string;
          messageId: string;
          labelId: string;
        };
        const { chatJid } = request.query as { chatJid: string };
        const client = getConnectedClient(server, instanceId);
        const result = method === 'PUT'
          ? await client.addMessageLabel(chatJid, messageId, labelId)
          : await client.removeMessageLabel(chatJid, messageId, labelId);
        return { success: true, data: requireCoreSuccess(result, `${method} message label`) };
      },
    });
  }

  server.get('/instances/:instanceId/labels/:labelId/chats', {
    schema: {
      tags: ['Business'],
      summary: 'List chats by label',
      params: {
        type: 'object',
        required: ['instanceId', 'labelId'],
        properties: { instanceId: { type: 'string' }, labelId: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { instanceId, labelId } = request.params as { instanceId: string; labelId: string };
    const items = getConnectedClient(server, instanceId).getChatsByLabel(labelId);
    return { success: true, data: { items, total: items.length } };
  });

  server.get('/instances/:instanceId/catalog/products', {
    schema: {
      tags: ['Business'],
      summary: 'List catalog products',
      params: instanceParams,
      querystring: {
        type: 'object',
        properties: { businessJid: { type: 'string' }, limit: { type: 'integer', minimum: 1 } },
      },
    },
  }, async (request) => {
    const { instanceId } = request.params as { instanceId: string };
    const { businessJid, limit } = request.query as { businessJid?: string; limit?: number };
    const catalog = requireCoreSuccess(
      await getConnectedClient(server, instanceId).getCatalog(businessJid, limit),
      'Get catalog products'
    );
    const items = catalog.products ?? [];
    return { success: true, data: { items, total: items.length } };
  });

  server.get('/instances/:instanceId/catalog/collections', {
    schema: {
      tags: ['Business'],
      summary: 'List catalog collections',
      params: instanceParams,
      querystring: { type: 'object', properties: { businessJid: { type: 'string' } } },
    },
  }, async (request) => {
    const { instanceId } = request.params as { instanceId: string };
    const { businessJid } = request.query as { businessJid?: string };
    const items = await getConnectedClient(server, instanceId).getCollections(businessJid);
    return { success: true, data: { items, total: items.length } };
  });

  server.post('/instances/:instanceId/catalog/products', {
    schema: {
      tags: ['Business'],
      summary: 'Create catalog product',
      params: instanceParams,
      body: { ...productBody, required: ['name', 'description', 'price', 'currency'] },
    },
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const result = await getConnectedClient(server, instanceId).createProduct(request.body as any);
    requireCoreSuccess(result, 'Create product');
    return reply.status(201).send({ success: true, data: { productId: result.productId } });
  });

  server.patch('/instances/:instanceId/catalog/products/:productId', {
    schema: {
      tags: ['Business'],
      summary: 'Update catalog product',
      params: {
        type: 'object',
        required: ['instanceId', 'productId'],
        properties: { instanceId: { type: 'string' }, productId: { type: 'string' } },
      },
      body: productBody,
    },
  }, async (request) => {
    const { instanceId, productId } = request.params as { instanceId: string; productId: string };
    const result = await getConnectedClient(server, instanceId).updateProduct(productId, request.body as any);
    requireCoreSuccess(result, 'Update product');
    return { success: true, data: { productId: result.productId ?? productId } };
  });

  server.delete('/instances/:instanceId/catalog/products/:productId', {
    schema: {
      tags: ['Business'],
      summary: 'Delete catalog product',
      params: {
        type: 'object',
        required: ['instanceId', 'productId'],
        properties: { instanceId: { type: 'string' }, productId: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { instanceId, productId } = request.params as { instanceId: string; productId: string };
    const result = await getConnectedClient(server, instanceId).deleteProducts([productId]);
    requireCoreSuccess(result, 'Delete product');
    return { success: true, data: { productId, removed: true } };
  });

  server.post('/instances/:instanceId/catalog/product-deletions', {
    schema: {
      tags: ['Business'],
      summary: 'Delete catalog products in bulk',
      params: instanceParams,
      body: {
        type: 'object',
        required: ['productIds'],
        properties: { productIds: { type: 'array', minItems: 1, items: { type: 'string' } } },
      },
    },
  }, async (request) => {
    const { instanceId } = request.params as { instanceId: string };
    const { productIds } = request.body as { productIds: string[] };
    const result = await getConnectedClient(server, instanceId).deleteProducts(productIds);
    requireCoreSuccess(result, 'Delete products');
    return { success: true, data: { productIds, removed: productIds.length } };
  });
}
