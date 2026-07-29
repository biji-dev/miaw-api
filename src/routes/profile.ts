import type { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getConnectedClient, requireCoreSuccess } from '../utils/client.js';

const params = {
  type: 'object',
  required: ['instanceId'],
  properties: { instanceId: { type: 'string' } },
};

export async function profileRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.patch('/instances/:instanceId/profile', {
    schema: {
      tags: ['Profile'],
      summary: 'Update own profile',
      params,
      body: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 25 },
          about: { type: 'string', maxLength: 139 },
        },
      },
    },
  }, async (request) => {
    const { instanceId } = request.params as { instanceId: string };
    const body = request.body as { name?: string; about?: string };
    const client = getConnectedClient(server, instanceId);
    if (body.name !== undefined) requireCoreSuccess(await client.updateProfileName(body.name), 'Update profile name');
    if (body.about !== undefined) requireCoreSuccess(await client.updateProfileStatus(body.about), 'Update profile about');
    return { success: true, data: { name: body.name, about: body.about } };
  });

  server.put('/instances/:instanceId/profile/picture', {
    schema: {
      tags: ['Profile'],
      summary: 'Set own profile picture',
      params,
      body: {
        type: 'object',
        required: ['url'],
        properties: { url: { type: 'string', pattern: '^https?://' } },
      },
    },
  }, async (request) => {
    const { instanceId } = request.params as { instanceId: string };
    const { url } = request.body as { url: string };
    const result = await getConnectedClient(server, instanceId).updateProfilePicture(url);
    requireCoreSuccess(result, 'Update profile picture');
    return { success: true, data: { updated: true } };
  });

  server.delete('/instances/:instanceId/profile/picture', {
    schema: { tags: ['Profile'], summary: 'Remove own profile picture', params },
  }, async (request) => {
    const { instanceId } = request.params as { instanceId: string };
    const result = await getConnectedClient(server, instanceId).removeProfilePicture();
    requireCoreSuccess(result, 'Remove profile picture');
    return { success: true, data: { removed: true } };
  });
}
