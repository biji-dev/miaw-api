import type { FastifyInstance } from 'fastify';
import type { BusinessProfileUpdate, QuickReplyInput } from 'miaw-core';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getConnectedClient } from '../utils/client.js';

const params = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };

export async function businessExtraRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.patch('/instances/:id/business/profile', { schema: { tags: ['Business'], summary: 'Update own business profile', params, body: {
    type: 'object', additionalProperties: false, properties: {
      address: { type: 'string' }, websites: { type: 'array', items: { type: 'string', format: 'uri' } },
      email: { type: 'string', format: 'email' }, description: { type: 'string' },
      hours: { type: 'object', required: ['timezone', 'days'], properties: {
        timezone: { type: 'string' }, days: { type: 'array', items: { type: 'object', required: ['day', 'mode'], properties: {
          day: { type: 'string', enum: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
          mode: { type: 'string', enum: ['specific_hours', 'open_24h', 'appointment_only'] },
          openTimeInMinutes: { type: 'string', pattern: '^[0-9]+$' }, closeTimeInMinutes: { type: 'string', pattern: '^[0-9]+$' },
        } } },
      } },
    },
  } } }, async (request) => {
    const { id } = request.params as { id: string };
    return { success: true, data: await getConnectedClient(server, id).updateBusinessProfile(request.body as BusinessProfileUpdate) };
  });

  server.post('/instances/:id/business/cover-photo', { schema: { tags: ['Business'], summary: 'Update business cover photo', params, body: {
    type: 'object', required: ['image'], properties: { image: { type: 'string', pattern: '^https?://' } },
  } } }, async (request) => {
    const { id } = request.params as { id: string };
    const { image } = request.body as { image: string };
    return { success: true, data: await getConnectedClient(server, id).updateCoverPhoto(image) };
  });
  server.delete('/instances/:id/business/cover-photo/:coverPhotoId', { schema: { tags: ['Business'], summary: 'Remove business cover photo' } }, async (request) => {
    const { id, coverPhotoId } = request.params as { id: string; coverPhotoId: string };
    return { success: true, data: await getConnectedClient(server, id).removeCoverPhoto(coverPhotoId) };
  });

  server.post('/instances/:id/business/orders/details', { schema: { tags: ['Business'], summary: 'Get business order details', params, body: {
    type: 'object', required: ['orderId', 'tokenBase64'], properties: { orderId: { type: 'string' }, tokenBase64: { type: 'string' } },
  } } }, async (request) => {
    const { id } = request.params as { id: string };
    const { orderId, tokenBase64 } = request.body as { orderId: string; tokenBase64: string };
    return { success: true, data: await getConnectedClient(server, id).getOrderDetails(orderId, tokenBase64) };
  });

  server.post('/instances/:id/business/quick-replies', { schema: { tags: ['Business'], summary: 'Add business quick reply', params, body: {
    type: 'object', required: ['shortcut', 'message'], properties: { shortcut: { type: 'string' }, message: { type: 'string' }, keywords: { type: 'array', items: { type: 'string' } } },
  } } }, async (request) => {
    const { id } = request.params as { id: string };
    return { success: true, data: await getConnectedClient(server, id).addQuickReply(request.body as QuickReplyInput) };
  });
  server.delete('/instances/:id/business/quick-replies/:timestamp', { schema: { tags: ['Business'], summary: 'Remove business quick reply' } }, async (request) => {
    const { id, timestamp } = request.params as { id: string; timestamp: string };
    return { success: true, data: await getConnectedClient(server, id).removeQuickReply(timestamp) };
  });
}
