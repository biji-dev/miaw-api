import type { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth.js';
import { BadRequestError } from '../utils/errorHandler.js';
import { getConnectedClient, requireCoreSuccess, requireMessage } from '../utils/client.js';
import { normalizeContactId } from './contacts.js';

const instanceParams = {
  type: 'object',
  required: ['instanceId'],
  properties: { instanceId: { type: 'string' } },
};

export async function presenceRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.put('/instances/:instanceId/presence', {
    schema: {
      tags: ['Presence'],
      summary: 'Set account availability',
      params: instanceParams,
      body: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', enum: ['available', 'unavailable'] } },
      },
    },
  }, async (request) => {
    const { instanceId } = request.params as { instanceId: string };
    const { status } = request.body as { status: 'available' | 'unavailable' };
    await getConnectedClient(server, instanceId).setPresence(status);
    return { success: true, data: { status } };
  });

  server.put('/instances/:instanceId/chats/:chatJid/presence', {
    schema: {
      tags: ['Presence'],
      summary: 'Set chat presence',
      params: {
        type: 'object',
        required: ['instanceId', 'chatJid'],
        properties: {
          instanceId: { type: 'string' },
          chatJid: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['state'],
        properties: { state: { type: 'string', enum: ['typing', 'recording', 'paused'] } },
      },
    },
  }, async (request) => {
    const { instanceId, chatJid } = request.params as { instanceId: string; chatJid: string };
    const { state } = request.body as { state: 'typing' | 'recording' | 'paused' };
    const client = getConnectedClient(server, instanceId);
    if (state === 'typing') await client.sendTyping(chatJid);
    else if (state === 'recording') await client.sendRecording(chatJid);
    else await client.stopTyping(chatJid);
    return { success: true, data: { state } };
  });

  server.put('/instances/:instanceId/messages/:messageId/read-receipt', {
    schema: {
      tags: ['Presence'],
      summary: 'Send a message read receipt',
      params: {
        type: 'object',
        required: ['instanceId', 'messageId'],
        properties: {
          instanceId: { type: 'string' },
          messageId: { type: 'string' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          chatJid: {
            type: 'string',
            description: 'Optional chat JID to speed up message lookup',
          },
        },
      },
    },
  }, async (request) => {
    const { instanceId, messageId } = request.params as { instanceId: string; messageId: string };
    const { chatJid } = request.query as { chatJid?: string };
    const client = getConnectedClient(server, instanceId);
    const message = await requireMessage(client, messageId, chatJid);
    const result = await client.markAsRead(message);
    if (!result) throw new BadRequestError('Mark as read failed');
    return { success: true, data: { messageId, read: true } };
  });

  server.put('/instances/:instanceId/contacts/:contactId/presence-subscription', {
    schema: {
      tags: ['Presence'],
      summary: 'Subscribe to contact presence',
      params: {
        type: 'object',
        required: ['instanceId', 'contactId'],
        properties: {
          instanceId: { type: 'string' },
          contactId: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { instanceId, contactId } = request.params as { instanceId: string; contactId: string };
    const { jid } = normalizeContactId(contactId);
    const result = await getConnectedClient(server, instanceId).subscribePresence(jid);
    return { success: true, data: requireCoreSuccess(result, 'Subscribe to presence') };
  });
}
