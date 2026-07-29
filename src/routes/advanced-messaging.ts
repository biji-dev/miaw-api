import type { FastifyInstance } from 'fastify';
import type { ContactCard } from 'miaw-core';
import { createAuthMiddleware } from '../middleware/auth.js';
import { BadRequestError } from '../utils/errorHandler.js';
import { getConnectedClient, requireCoreSuccess, requireMessage, resolveQuote } from '../utils/client.js';

const params = {
  type: 'object', required: ['instanceId'], properties: { instanceId: { type: 'string' } },
};
const mediaUrl = { type: 'string', pattern: '^https?://' };

export async function advancedMessagingRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.post('/instances/:instanceId/messages/location', {
    schema: { tags: ['Messaging'], summary: 'Send location', params, body: {
      type: 'object', required: ['to', 'latitude', 'longitude'], properties: {
        to: { type: 'string' }, latitude: { type: 'number', minimum: -90, maximum: 90 },
        longitude: { type: 'number', minimum: -180, maximum: 180 }, name: { type: 'string' },
        address: { type: 'string' }, quoted: { type: 'string' }, quotedChatJid: { type: 'string' },
      },
    } },
  }, async (request) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const body = request.body as { to: string; latitude: number; longitude: number; name?: string; address?: string; quoted?: string; quotedChatJid?: string };
    const client = getConnectedClient(server, id);
    const quoted = await resolveQuote(client, body.quoted, body.quotedChatJid);
    const result = await client.sendLocation(body.to, body.latitude, body.longitude, { name: body.name, address: body.address, quoted });
    return { success: true, data: requireCoreSuccess(result, 'Send location') };
  });

  server.post('/instances/:instanceId/messages/contact', {
    schema: { tags: ['Messaging'], summary: 'Send contact cards', params, body: {
      type: 'object', required: ['to', 'contacts'], properties: {
        to: { type: 'string' }, contacts: { type: 'array', minItems: 1, items: { type: 'object', required: ['fullName', 'phone'], properties: {
          fullName: { type: 'string' }, phone: { type: 'string', pattern: '^[0-9]+$' }, organization: { type: 'string' },
        } } }, quoted: { type: 'string' }, quotedChatJid: { type: 'string' },
      },
    } },
  }, async (request) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const body = request.body as { to: string; contacts: ContactCard[]; quoted?: string; quotedChatJid?: string };
    const client = getConnectedClient(server, id);
    const quoted = await resolveQuote(client, body.quoted, body.quotedChatJid);
    const result = await client.sendContact(body.to, body.contacts, { quoted });
    return { success: true, data: requireCoreSuccess(result, 'Send contact') };
  });

  server.post('/instances/:instanceId/messages/sticker', {
    schema: { tags: ['Messaging'], summary: 'Send WebP sticker', params, body: { type: 'object', required: ['to', 'sticker'], properties: {
      to: { type: 'string' }, sticker: mediaUrl, quoted: { type: 'string' }, quotedChatJid: { type: 'string' },
    } } },
  }, async (request) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const body = request.body as { to: string; sticker: string; quoted?: string; quotedChatJid?: string };
    const client = getConnectedClient(server, id);
    const quoted = await resolveQuote(client, body.quoted, body.quotedChatJid);
    const result = await client.sendSticker(body.to, body.sticker, { quoted });
    return { success: true, data: requireCoreSuccess(result, 'Send sticker') };
  });

  server.post('/instances/:instanceId/messages/poll', {
    schema: { tags: ['Messaging'], summary: 'Send poll', params, body: { type: 'object', required: ['to', 'name', 'options'], properties: {
      to: { type: 'string' }, name: { type: 'string' }, options: { type: 'array', minItems: 2, items: { type: 'string' } },
      selectableCount: { type: 'integer', minimum: 1 }, quoted: { type: 'string' }, quotedChatJid: { type: 'string' },
    } } },
  }, async (request) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const body = request.body as { to: string; name: string; options: string[]; selectableCount?: number; quoted?: string; quotedChatJid?: string };
    if (body.selectableCount && body.selectableCount > body.options.length) throw new BadRequestError('selectableCount cannot exceed option count');
    const client = getConnectedClient(server, id);
    const quoted = await resolveQuote(client, body.quoted, body.quotedChatJid);
    const result = await client.sendPoll(body.to, body.name, body.options, { selectableCount: body.selectableCount, quoted });
    return { success: true, data: requireCoreSuccess(result, 'Send poll') };
  });

  for (const kind of ['text', 'image', 'video'] as const) {
    server.post(`/instances/:instanceId/statuses/${kind}`, {
      schema: { tags: ['Statuses'], summary: `Post ${kind} status`, params, body: {
        type: 'object', required: [kind === 'text' ? 'text' : kind], properties: {
          text: { type: 'string' }, image: mediaUrl, video: mediaUrl,
          recipients: { type: 'array', items: { type: 'string' } }, caption: { type: 'string' },
          backgroundColor: { type: 'string' }, font: { type: 'integer' },
        },
      } },
    }, async (request) => {
      const { instanceId: id } = request.params as { instanceId: string };
      const body = request.body as { text?: string; image?: string; video?: string; recipients?: string[]; caption?: string; backgroundColor?: string; font?: number };
      const client = getConnectedClient(server, id);
      const options = { caption: body.caption, backgroundColor: body.backgroundColor, font: body.font };
      const result = kind === 'text'
        ? await client.postTextStatus(body.text!, body.recipients, options)
        : kind === 'image'
          ? await client.postImageStatus(body.image!, body.recipients, options)
          : await client.postVideoStatus(body.video!, body.recipients, options);
      return { success: true, data: requireCoreSuccess(result, `Post ${kind} status`) };
    });
  }

  const chatActions = [
    ['PUT', 'archive', (client: ReturnType<typeof getConnectedClient>, jid: string) => client.archiveChat(jid)],
    ['DELETE', 'archive', (client: ReturnType<typeof getConnectedClient>, jid: string) => client.unarchiveChat(jid)],
    ['PUT', 'pin', (client: ReturnType<typeof getConnectedClient>, jid: string) => client.pinChat(jid)],
    ['DELETE', 'pin', (client: ReturnType<typeof getConnectedClient>, jid: string) => client.unpinChat(jid)],
  ] as const;
  for (const [method, action, execute] of chatActions) {
    server.route({ method, url: `/instances/:instanceId/chats/:chatJid/${action}`, schema: { tags: ['Chats'], summary: `${method === 'DELETE' ? 'Undo' : ''} ${action} chat` }, handler: async (request) => {
      const { instanceId: id, chatJid } = request.params as { instanceId: string; chatJid: string };
      const result = await execute(getConnectedClient(server, id), chatJid);
      return { success: true, data: requireCoreSuccess(result, `${method} chat ${action}`) };
    } });
  }

  server.put('/instances/:instanceId/chats/:chatJid/read-state', { schema: { tags: ['Chats'], summary: 'Set chat read state', body: {
    type: 'object', required: ['read'], properties: { read: { type: 'boolean' } },
  } } }, async (request) => {
    const { instanceId: id, chatJid } = request.params as { instanceId: string; chatJid: string };
    const { read } = request.body as { read: boolean };
    const client = getConnectedClient(server, id);
    const result = read ? await client.markChatRead(chatJid) : await client.markChatUnread(chatJid);
    return { success: true, data: requireCoreSuccess(result, 'Set chat read state') };
  });

  server.put('/instances/:instanceId/chats/:chatJid/mute', { schema: { tags: ['Chats'], summary: 'Mute chat', body: { type: 'object', properties: { durationMs: { type: 'integer', minimum: 1 } } } } }, async (request) => {
    const { instanceId: id, chatJid } = request.params as { instanceId: string; chatJid: string };
    const { durationMs } = request.body as { durationMs?: number };
    const result = await getConnectedClient(server, id).muteChat(chatJid, durationMs);
    return { success: true, data: requireCoreSuccess(result, 'Mute chat') };
  });
  server.delete('/instances/:instanceId/chats/:chatJid/mute', { schema: { tags: ['Chats'], summary: 'Unmute chat' } }, async (request) => {
    const { instanceId: id, chatJid } = request.params as { instanceId: string; chatJid: string };
    const result = await getConnectedClient(server, id).unmuteChat(chatJid);
    return { success: true, data: requireCoreSuccess(result, 'Unmute chat') };
  });
  server.delete('/instances/:instanceId/chats/:chatJid/messages', { schema: { tags: ['Chats'], summary: 'Clear chat messages' } }, async (request) => {
    const { instanceId: id, chatJid } = request.params as { instanceId: string; chatJid: string };
    const result = await getConnectedClient(server, id).clearChat(chatJid);
    return { success: true, data: requireCoreSuccess(result, 'Clear chat') };
  });
  server.delete('/instances/:instanceId/chats/:chatJid', { schema: { tags: ['Chats'], summary: 'Delete chat' } }, async (request) => {
    const { instanceId: id, chatJid } = request.params as { instanceId: string; chatJid: string };
    const result = await getConnectedClient(server, id).deleteChat(chatJid);
    return { success: true, data: requireCoreSuccess(result, 'Delete chat') };
  });
  for (const method of ['PUT', 'DELETE'] as const) {
    server.route({ method, url: '/instances/:instanceId/messages/:messageId/star', schema: { tags: ['Chats'], summary: `${method === 'PUT' ? 'Star' : 'Unstar'} message` }, handler: async (request) => {
      const { instanceId: id, messageId } = request.params as { instanceId: string; messageId: string };
      const { chatJid } = request.query as { chatJid?: string };
      const client = getConnectedClient(server, id);
      const message = await requireMessage(client, messageId, chatJid);
      const result = method === 'PUT' ? await client.starMessage(message) : await client.unstarMessage(message);
      return { success: true, data: requireCoreSuccess(result, `${method === 'PUT' ? 'Star' : 'Unstar'} message`) };
    } });
  }
}
