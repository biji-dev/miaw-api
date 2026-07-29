import type { FastifyInstance } from 'fastify';
import type { BusinessProfileUpdate, QuickReplyInput } from 'miaw-core';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getConnectedClient, requireCoreSuccess } from '../utils/client.js';

const params = { type: 'object', required: ['instanceId'], properties: { instanceId: { type: 'string' } } };

export async function businessExtraRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.patch('/instances/:instanceId/business/profile', { schema: { tags: ['Business'], summary: 'Update own business profile', params, body: {
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
    const { instanceId: id } = request.params as { instanceId: string };
    const result = await getConnectedClient(server, id).updateBusinessProfile(request.body as BusinessProfileUpdate);
    return { success: true, data: requireCoreSuccess(result, 'Update business profile') };
  });

  server.post('/instances/:instanceId/business/cover-photos', { schema: { tags: ['Business'], summary: 'Update business cover photo', params, body: {
    type: 'object', required: ['image'], properties: { image: { type: 'string', pattern: '^https?://' } },
  } } }, async (request, reply) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const { image } = request.body as { image: string };
    const data = requireCoreSuccess(
      await getConnectedClient(server, id).updateCoverPhoto(image),
      'Update cover photo'
    );
    return reply.status(201).send({ success: true, data });
  });
  server.delete('/instances/:instanceId/business/cover-photos/:coverPhotoId', { schema: { tags: ['Business'], summary: 'Remove business cover photo' } }, async (request) => {
    const { instanceId: id, coverPhotoId } = request.params as { instanceId: string; coverPhotoId: string };
    return { success: true, data: requireCoreSuccess(await getConnectedClient(server, id).removeCoverPhoto(coverPhotoId), 'Remove cover photo') };
  });

  server.post('/instances/:instanceId/business/order-lookups', { schema: { tags: ['Business'], summary: 'Get business order details', params, body: {
    type: 'object', required: ['orderId', 'tokenBase64'], properties: { orderId: { type: 'string' }, tokenBase64: { type: 'string' } },
  } } }, async (request) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const { orderId, tokenBase64 } = request.body as { orderId: string; tokenBase64: string };
    return { success: true, data: await getConnectedClient(server, id).getOrderDetails(orderId, tokenBase64) };
  });

  server.post('/instances/:instanceId/business/quick-replies', { schema: { tags: ['Business'], summary: 'Add business quick reply', params, body: {
    type: 'object', required: ['shortcut', 'message'], properties: { shortcut: { type: 'string' }, message: { type: 'string' }, keywords: { type: 'array', items: { type: 'string' } } },
  } } }, async (request, reply) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const result = await getConnectedClient(server, id).addQuickReply(request.body as QuickReplyInput);
    return reply.status(201).send({
      success: true,
      data: requireCoreSuccess(result, 'Create quick reply'),
    });
  });
  server.delete('/instances/:instanceId/business/quick-replies/:timestamp', { schema: { tags: ['Business'], summary: 'Remove business quick reply' } }, async (request) => {
    const { instanceId: id, timestamp } = request.params as { instanceId: string; timestamp: string };
    const result = await getConnectedClient(server, id).removeQuickReply(timestamp);
    return { success: true, data: requireCoreSuccess(result, 'Delete quick reply') };
  });
}
