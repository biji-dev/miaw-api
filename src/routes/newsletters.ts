import type { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getConnectedClient, requireCoreSuccess } from '../utils/client.js';

const instanceParams = {
  type: 'object',
  required: ['instanceId'],
  properties: { instanceId: { type: 'string' } },
};
const newsletterParams = {
  type: 'object',
  required: ['instanceId', 'newsletterId'],
  properties: {
    instanceId: { type: 'string' },
    newsletterId: { type: 'string' },
  },
};

export async function newsletterRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.post('/instances/:instanceId/newsletters', {
    schema: {
      tags: ['Newsletters'],
      summary: 'Create newsletter',
      params: instanceParams,
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' }, description: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const { name, description } = request.body as { name: string; description?: string };
    const result = requireCoreSuccess(
      await getConnectedClient(server, instanceId).createNewsletter(name, description),
      'Create newsletter'
    );
    return reply.status(201).send({ success: true, data: result });
  });

  server.get('/instances/:instanceId/newsletters/:newsletterId', {
    schema: { tags: ['Newsletters'], summary: 'Get newsletter', params: newsletterParams },
  }, async (request) => {
    const { instanceId, newsletterId } = request.params as { instanceId: string; newsletterId: string };
    return { success: true, data: await getConnectedClient(server, instanceId).getNewsletterMetadata(newsletterId) };
  });

  server.patch('/instances/:instanceId/newsletters/:newsletterId', {
    schema: {
      tags: ['Newsletters'],
      summary: 'Update newsletter',
      params: newsletterParams,
      body: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: { name: { type: 'string' }, description: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { instanceId, newsletterId } = request.params as { instanceId: string; newsletterId: string };
    const body = request.body as { name?: string; description?: string };
    const client = getConnectedClient(server, instanceId);
    if (body.name !== undefined) requireCoreSuccess(await client.updateNewsletterName(newsletterId, body.name), 'Update newsletter name');
    if (body.description !== undefined) requireCoreSuccess(await client.updateNewsletterDescription(newsletterId, body.description), 'Update newsletter description');
    return { success: true, data: { newsletterId, ...body } };
  });

  server.delete('/instances/:instanceId/newsletters/:newsletterId', {
    schema: { tags: ['Newsletters'], summary: 'Delete newsletter', params: newsletterParams },
  }, async (request) => {
    const { instanceId, newsletterId } = request.params as { instanceId: string; newsletterId: string };
    const result = await getConnectedClient(server, instanceId).deleteNewsletter(newsletterId);
    requireCoreSuccess(result, 'Delete newsletter');
    return { success: true, data: { newsletterId, removed: true } };
  });

  server.get('/instances/:instanceId/newsletters/:newsletterId/messages', {
    schema: {
      tags: ['Newsletters'],
      summary: 'List newsletter messages',
      params: newsletterParams,
      querystring: { type: 'object', properties: { limit: { type: 'integer', minimum: 1 } } },
    },
  }, async (request) => {
    const { instanceId, newsletterId } = request.params as { instanceId: string; newsletterId: string };
    const { limit } = request.query as { limit?: number };
    const result = requireCoreSuccess(
      await getConnectedClient(server, instanceId).fetchNewsletterMessages(newsletterId, limit),
      'List newsletter messages'
    );
    const items = result.messages ?? [];
    return { success: true, data: { items, total: items.length } };
  });

  const messageTypes = ['text', 'image', 'video'] as const;
  for (const kind of messageTypes) {
    server.post(`/instances/:instanceId/newsletters/:newsletterId/messages/${kind}`, {
      schema: {
        tags: ['Newsletters'],
        summary: `Send newsletter ${kind}`,
        params: newsletterParams,
        body: {
          type: 'object',
          required: [kind],
          properties: {
            text: { type: 'string' },
            image: { type: 'string', pattern: '^https?://' },
            video: { type: 'string', pattern: '^https?://' },
            caption: { type: 'string' },
          },
        },
      },
    }, async (request) => {
      const { instanceId, newsletterId } = request.params as { instanceId: string; newsletterId: string };
      const body = request.body as { text?: string; image?: string; video?: string; caption?: string };
      const client = getConnectedClient(server, instanceId);
      const result = kind === 'text'
        ? await client.sendNewsletterMessage(newsletterId, body.text!)
        : kind === 'image'
          ? await client.sendNewsletterImage(newsletterId, body.image!, body.caption)
          : await client.sendNewsletterVideo(newsletterId, body.video!, body.caption);
      return { success: true, data: requireCoreSuccess(result, `Send newsletter ${kind}`) };
    });
  }

  const states = [
    ['follow', 'followNewsletter', 'unfollowNewsletter'],
    ['mute', 'muteNewsletter', 'unmuteNewsletter'],
  ] as const;
  for (const [path, enable, disable] of states) {
    for (const method of ['PUT', 'DELETE'] as const) {
      server.route({
        method,
        url: `/instances/:instanceId/newsletters/:newsletterId/${path}`,
        schema: { tags: ['Newsletters'], summary: `${method === 'PUT' ? 'Enable' : 'Disable'} newsletter ${path}`, params: newsletterParams },
        handler: async (request) => {
          const { instanceId, newsletterId } = request.params as { instanceId: string; newsletterId: string };
          const client = getConnectedClient(server, instanceId);
          const result = method === 'PUT'
            ? await client[enable](newsletterId)
            : await client[disable](newsletterId);
          return { success: true, data: requireCoreSuccess(result, `${method} newsletter ${path}`) };
        },
      });
    }
  }

  server.put('/instances/:instanceId/newsletters/:newsletterId/updates-subscription', {
    schema: { tags: ['Newsletters'], summary: 'Subscribe to newsletter updates', params: newsletterParams },
  }, async (request) => {
    const { instanceId, newsletterId } = request.params as { instanceId: string; newsletterId: string };
    const result = await getConnectedClient(server, instanceId).subscribeNewsletterUpdates(newsletterId);
    return { success: true, data: { subscribed: result } };
  });

  server.put('/instances/:instanceId/newsletters/:newsletterId/picture', {
    schema: {
      tags: ['Newsletters'],
      summary: 'Set newsletter picture',
      params: newsletterParams,
      body: {
        type: 'object',
        required: ['image'],
        properties: { image: { type: 'string', pattern: '^https?://' } },
      },
    },
  }, async (request) => {
    const { instanceId, newsletterId } = request.params as { instanceId: string; newsletterId: string };
    const { image } = request.body as { image: string };
    const result = await getConnectedClient(server, instanceId).updateNewsletterPicture(newsletterId, image);
    return { success: true, data: requireCoreSuccess(result, 'Update newsletter picture') };
  });

  server.delete('/instances/:instanceId/newsletters/:newsletterId/picture', {
    schema: { tags: ['Newsletters'], summary: 'Remove newsletter picture', params: newsletterParams },
  }, async (request) => {
    const { instanceId, newsletterId } = request.params as { instanceId: string; newsletterId: string };
    const result = await getConnectedClient(server, instanceId).removeNewsletterPicture(newsletterId);
    return { success: true, data: requireCoreSuccess(result, 'Remove newsletter picture') };
  });

  server.get('/instances/:instanceId/newsletters/:newsletterId/subscribers', {
    schema: { tags: ['Newsletters'], summary: 'List newsletter subscribers', params: newsletterParams },
  }, async (request) => {
    const { instanceId, newsletterId } = request.params as { instanceId: string; newsletterId: string };
    const subscription = await getConnectedClient(server, instanceId).getNewsletterSubscribers(newsletterId);
    return { success: true, data: subscription };
  });

  server.get('/instances/:instanceId/newsletters/:newsletterId/admins/count', {
    schema: { tags: ['Newsletters'], summary: 'Get newsletter admin count', params: newsletterParams },
  }, async (request) => {
    const { instanceId, newsletterId } = request.params as { instanceId: string; newsletterId: string };
    const count = await getConnectedClient(server, instanceId).getNewsletterAdminCount(newsletterId);
    return { success: true, data: { count } };
  });

  server.patch('/instances/:instanceId/newsletters/:newsletterId/owner', {
    schema: {
      tags: ['Newsletters'],
      summary: 'Change newsletter owner',
      params: newsletterParams,
      body: {
        type: 'object',
        required: ['ownerJid'],
        properties: { ownerJid: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { instanceId, newsletterId } = request.params as { instanceId: string; newsletterId: string };
    const { ownerJid } = request.body as { ownerJid: string };
    const result = await getConnectedClient(server, instanceId).changeNewsletterOwner(newsletterId, ownerJid);
    return { success: true, data: requireCoreSuccess(result, 'Change newsletter owner') };
  });

  server.delete('/instances/:instanceId/newsletters/:newsletterId/admins/:adminJid', {
    schema: { tags: ['Newsletters'], summary: 'Demote newsletter admin' },
  }, async (request) => {
    const { instanceId, newsletterId, adminJid } = request.params as { instanceId: string; newsletterId: string; adminJid: string };
    const result = await getConnectedClient(server, instanceId).demoteNewsletterAdmin(newsletterId, adminJid);
    return { success: true, data: requireCoreSuccess(result, 'Demote newsletter admin') };
  });

  for (const method of ['PUT', 'DELETE'] as const) {
    server.route({
      method,
      url: '/instances/:instanceId/newsletters/:newsletterId/messages/:messageId/reaction',
      schema: {
        tags: ['Newsletters'],
        summary: `${method === 'PUT' ? 'Set' : 'Remove'} newsletter message reaction`,
        ...(method === 'PUT'
          ? { body: { type: 'object', required: ['emoji'], properties: { emoji: { type: 'string', minLength: 1 } } } }
          : {}),
      },
      handler: async (request) => {
        const { instanceId, newsletterId, messageId } = request.params as {
          instanceId: string;
          newsletterId: string;
          messageId: string;
        };
        const emoji = method === 'PUT' ? (request.body as { emoji: string }).emoji : '';
        const result = await getConnectedClient(server, instanceId).reactToNewsletterMessage(newsletterId, messageId, emoji);
        return { success: true, data: { reacted: result, emoji: emoji || null } };
      },
    });
  }
}
