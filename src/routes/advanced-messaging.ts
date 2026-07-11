import type { FastifyInstance } from 'fastify';
import type { ContactCard } from 'miaw-core';
import { createAuthMiddleware } from '../middleware/auth.js';
import { BadRequestError } from '../utils/errorHandler.js';
import { getConnectedClient, requireMessage, resolveQuote } from '../utils/client.js';

const params = {
  type: 'object', required: ['id'], properties: { id: { type: 'string' } },
};
const mediaUrl = { type: 'string', pattern: '^https?://' };

export async function advancedMessagingRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.post('/instances/:id/messages/location', {
    schema: { tags: ['Messaging'], summary: 'Send location', params, body: {
      type: 'object', required: ['to', 'latitude', 'longitude'], properties: {
        to: { type: 'string' }, latitude: { type: 'number', minimum: -90, maximum: 90 },
        longitude: { type: 'number', minimum: -180, maximum: 180 }, name: { type: 'string' },
        address: { type: 'string' }, quoted: { type: 'string' }, quotedChatJid: { type: 'string' },
      },
    } },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { to: string; latitude: number; longitude: number; name?: string; address?: string; quoted?: string; quotedChatJid?: string };
    const client = getConnectedClient(server, id);
    const quoted = await resolveQuote(client, body.quoted, body.quotedChatJid);
    return { success: true, data: await client.sendLocation(body.to, body.latitude, body.longitude, { name: body.name, address: body.address, quoted }) };
  });

  server.post('/instances/:id/messages/contact', {
    schema: { tags: ['Messaging'], summary: 'Send contact cards', params, body: {
      type: 'object', required: ['to', 'contacts'], properties: {
        to: { type: 'string' }, contacts: { type: 'array', minItems: 1, items: { type: 'object', required: ['fullName', 'phone'], properties: {
          fullName: { type: 'string' }, phone: { type: 'string', pattern: '^[0-9]+$' }, organization: { type: 'string' },
        } } }, quoted: { type: 'string' }, quotedChatJid: { type: 'string' },
      },
    } },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { to: string; contacts: ContactCard[]; quoted?: string; quotedChatJid?: string };
    const client = getConnectedClient(server, id);
    const quoted = await resolveQuote(client, body.quoted, body.quotedChatJid);
    return { success: true, data: await client.sendContact(body.to, body.contacts, { quoted }) };
  });

  server.post('/instances/:id/messages/sticker', {
    schema: { tags: ['Messaging'], summary: 'Send WebP sticker', params, body: { type: 'object', required: ['to', 'sticker'], properties: {
      to: { type: 'string' }, sticker: mediaUrl, quoted: { type: 'string' }, quotedChatJid: { type: 'string' },
    } } },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { to: string; sticker: string; quoted?: string; quotedChatJid?: string };
    const client = getConnectedClient(server, id);
    const quoted = await resolveQuote(client, body.quoted, body.quotedChatJid);
    return { success: true, data: await client.sendSticker(body.to, body.sticker, { quoted }) };
  });

  server.post('/instances/:id/messages/poll', {
    schema: { tags: ['Messaging'], summary: 'Send poll', params, body: { type: 'object', required: ['to', 'name', 'options'], properties: {
      to: { type: 'string' }, name: { type: 'string' }, options: { type: 'array', minItems: 2, items: { type: 'string' } },
      selectableCount: { type: 'integer', minimum: 1 }, quoted: { type: 'string' }, quotedChatJid: { type: 'string' },
    } } },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { to: string; name: string; options: string[]; selectableCount?: number; quoted?: string; quotedChatJid?: string };
    if (body.selectableCount && body.selectableCount > body.options.length) throw new BadRequestError('selectableCount cannot exceed option count');
    const client = getConnectedClient(server, id);
    const quoted = await resolveQuote(client, body.quoted, body.quotedChatJid);
    return { success: true, data: await client.sendPoll(body.to, body.name, body.options, { selectableCount: body.selectableCount, quoted }) };
  });

  for (const kind of ['text', 'image', 'video'] as const) {
    server.post(`/instances/:id/statuses/${kind}`, {
      schema: { tags: ['Statuses'], summary: `Post ${kind} status`, params, body: {
        type: 'object', required: [kind === 'text' ? 'text' : kind], properties: {
          text: { type: 'string' }, image: mediaUrl, video: mediaUrl,
          recipients: { type: 'array', items: { type: 'string' } }, caption: { type: 'string' },
          backgroundColor: { type: 'string' }, font: { type: 'integer' },
        },
      } },
    }, async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as { text?: string; image?: string; video?: string; recipients?: string[]; caption?: string; backgroundColor?: string; font?: number };
      const client = getConnectedClient(server, id);
      const options = { caption: body.caption, backgroundColor: body.backgroundColor, font: body.font };
      const result = kind === 'text'
        ? await client.postTextStatus(body.text!, body.recipients, options)
        : kind === 'image'
          ? await client.postImageStatus(body.image!, body.recipients, options)
          : await client.postVideoStatus(body.video!, body.recipients, options);
      return { success: true, data: result };
    });
  }

  const chatActions = [
    ['POST', 'archive', (client: ReturnType<typeof getConnectedClient>, jid: string) => client.archiveChat(jid)],
    ['DELETE', 'archive', (client: ReturnType<typeof getConnectedClient>, jid: string) => client.unarchiveChat(jid)],
    ['POST', 'pin', (client: ReturnType<typeof getConnectedClient>, jid: string) => client.pinChat(jid)],
    ['DELETE', 'pin', (client: ReturnType<typeof getConnectedClient>, jid: string) => client.unpinChat(jid)],
    ['POST', 'read', (client: ReturnType<typeof getConnectedClient>, jid: string) => client.markChatRead(jid)],
    ['DELETE', 'read', (client: ReturnType<typeof getConnectedClient>, jid: string) => client.markChatUnread(jid)],
  ] as const;
  for (const [method, action, execute] of chatActions) {
    server.route({ method, url: `/instances/:id/chats/:jid/${action}`, schema: { tags: ['Chats'], summary: `${method === 'DELETE' ? 'Undo' : ''} ${action} chat` }, handler: async (request) => {
      const { id, jid } = request.params as { id: string; jid: string };
      return { success: true, data: await execute(getConnectedClient(server, id), jid) };
    } });
  }

  server.post('/instances/:id/chats/:jid/mute', { schema: { tags: ['Chats'], summary: 'Mute chat', body: { type: 'object', properties: { durationMs: { type: 'integer', minimum: 1 } } } } }, async (request) => {
    const { id, jid } = request.params as { id: string; jid: string };
    const { durationMs } = request.body as { durationMs?: number };
    return { success: true, data: await getConnectedClient(server, id).muteChat(jid, durationMs) };
  });
  server.delete('/instances/:id/chats/:jid/mute', { schema: { tags: ['Chats'], summary: 'Unmute chat' } }, async (request) => {
    const { id, jid } = request.params as { id: string; jid: string };
    return { success: true, data: await getConnectedClient(server, id).unmuteChat(jid) };
  });
  server.delete('/instances/:id/chats/:jid/messages', { schema: { tags: ['Chats'], summary: 'Clear chat messages' } }, async (request) => {
    const { id, jid } = request.params as { id: string; jid: string };
    return { success: true, data: await getConnectedClient(server, id).clearChat(jid) };
  });
  server.delete('/instances/:id/chats/:jid', { schema: { tags: ['Chats'], summary: 'Delete chat' } }, async (request) => {
    const { id, jid } = request.params as { id: string; jid: string };
    return { success: true, data: await getConnectedClient(server, id).deleteChat(jid) };
  });
  for (const method of ['POST', 'DELETE'] as const) {
    server.route({ method, url: '/instances/:id/messages/:messageId/star', schema: { tags: ['Chats'], summary: `${method === 'POST' ? 'Star' : 'Unstar'} message` }, handler: async (request) => {
      const { id, messageId } = request.params as { id: string; messageId: string };
      const { chatJid } = request.query as { chatJid?: string };
      const client = getConnectedClient(server, id);
      const message = await requireMessage(client, messageId, chatJid);
      return { success: true, data: method === 'POST' ? await client.starMessage(message) : await client.unstarMessage(message) };
    } });
  }
}
