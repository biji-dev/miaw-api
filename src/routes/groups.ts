import type { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth.js';
import { BadRequestError } from '../utils/errorHandler.js';
import { getConnectedClient, requireCoreSuccess } from '../utils/client.js';

const instanceParams = {
  type: 'object',
  required: ['instanceId'],
  properties: { instanceId: { type: 'string' } },
};
const groupParams = {
  type: 'object',
  required: ['instanceId', 'groupJid'],
  properties: {
    instanceId: { type: 'string' },
    groupJid: { type: 'string' },
  },
};

export async function groupRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.post('/instances/:instanceId/groups', {
    schema: {
      tags: ['Groups'],
      summary: 'Create group',
      params: instanceParams,
      body: {
        type: 'object',
        required: ['name', 'participants'],
        properties: {
          name: { type: 'string', minLength: 1 },
          participants: { type: 'array', minItems: 1, items: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const body = request.body as { name: string; participants: string[] };
    const result = requireCoreSuccess(
      await getConnectedClient(server, instanceId).createGroup(body.name, body.participants),
      'Create group'
    );
    return reply.status(201).send({ success: true, data: result });
  });

  server.get('/instances/:instanceId/groups/:groupJid', {
    schema: { tags: ['Groups'], summary: 'Get group', params: groupParams },
  }, async (request) => {
    const { instanceId, groupJid } = request.params as { instanceId: string; groupJid: string };
    return { success: true, data: await getConnectedClient(server, instanceId).getGroupInfo(groupJid) };
  });

  server.patch('/instances/:instanceId/groups/:groupJid', {
    schema: {
      tags: ['Groups'],
      summary: 'Update group',
      params: groupParams,
      body: {
        type: 'object',
        minProperties: 1,
        additionalProperties: false,
        properties: { name: { type: 'string' }, description: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { instanceId, groupJid } = request.params as { instanceId: string; groupJid: string };
    const body = request.body as { name?: string; description?: string };
    const client = getConnectedClient(server, instanceId);
    if (body.name !== undefined) requireCoreSuccess(await client.updateGroupName(groupJid, body.name), 'Update group name');
    if (body.description !== undefined) requireCoreSuccess(await client.updateGroupDescription(groupJid, body.description), 'Update group description');
    return { success: true, data: { groupJid, ...body } };
  });

  server.delete('/instances/:instanceId/groups/:groupJid', {
    schema: { tags: ['Groups'], summary: 'Leave group', params: groupParams },
  }, async (request) => {
    const { instanceId, groupJid } = request.params as { instanceId: string; groupJid: string };
    const result = await getConnectedClient(server, instanceId).leaveGroup(groupJid);
    requireCoreSuccess(result, 'Leave group');
    return { success: true, data: { groupJid, removed: true } };
  });

  server.get('/instances/:instanceId/groups/:groupJid/participants', {
    schema: { tags: ['Groups'], summary: 'List group participants', params: groupParams },
  }, async (request) => {
    const { instanceId, groupJid } = request.params as { instanceId: string; groupJid: string };
    const items = await getConnectedClient(server, instanceId).getGroupParticipants(groupJid) ?? [];
    return { success: true, data: { items, total: items.length } };
  });

  server.patch('/instances/:instanceId/groups/:groupJid/participants', {
    schema: {
      tags: ['Groups'],
      summary: 'Change group participants',
      params: groupParams,
      body: {
        type: 'object',
        required: ['operation', 'participants'],
        properties: {
          operation: { type: 'string', enum: ['add', 'remove', 'promote', 'demote'] },
          participants: { type: 'array', minItems: 1, items: { type: 'string' } },
        },
      },
    },
  }, async (request) => {
    const { instanceId, groupJid } = request.params as { instanceId: string; groupJid: string };
    const { operation, participants } = request.body as {
      operation: 'add' | 'remove' | 'promote' | 'demote';
      participants: string[];
    };
    const client = getConnectedClient(server, instanceId);
    const result = operation === 'add'
      ? await client.addParticipants(groupJid, participants)
      : operation === 'remove'
        ? await client.removeParticipants(groupJid, participants)
        : operation === 'promote'
          ? await client.promoteToAdmin(groupJid, participants)
          : await client.demoteFromAdmin(groupJid, participants);
    return { success: true, data: requireCoreSuccess(result, `${operation} group participants`) };
  });

  server.put('/instances/:instanceId/groups/:groupJid/picture', {
    schema: {
      tags: ['Groups'],
      summary: 'Set group picture',
      params: groupParams,
      body: {
        type: 'object',
        required: ['url'],
        properties: { url: { type: 'string', pattern: '^https?://' } },
      },
    },
  }, async (request) => {
    const { instanceId, groupJid } = request.params as { instanceId: string; groupJid: string };
    const { url } = request.body as { url: string };
    const result = await getConnectedClient(server, instanceId).updateGroupPicture(groupJid, url);
    return { success: true, data: requireCoreSuccess(result, 'Update group picture') };
  });

  server.get('/instances/:instanceId/groups/:groupJid/invite', {
    schema: { tags: ['Groups'], summary: 'Get group invite', params: groupParams },
  }, async (request) => {
    const { instanceId, groupJid } = request.params as { instanceId: string; groupJid: string };
    const inviteUrl = await getConnectedClient(server, instanceId).getGroupInviteLink(groupJid);
    return { success: true, data: { inviteUrl } };
  });

  server.delete('/instances/:instanceId/groups/:groupJid/invite', {
    schema: { tags: ['Groups'], summary: 'Revoke group invite', params: groupParams },
  }, async (request) => {
    const { instanceId, groupJid } = request.params as { instanceId: string; groupJid: string };
    const inviteUrl = await getConnectedClient(server, instanceId).revokeGroupInvite(groupJid);
    return { success: true, data: { inviteUrl } };
  });

  server.get('/instances/:instanceId/group-invites/:inviteCode', {
    schema: {
      tags: ['Groups'],
      summary: 'Get group invite information',
      params: {
        type: 'object',
        required: ['instanceId', 'inviteCode'],
        properties: { instanceId: { type: 'string' }, inviteCode: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { instanceId, inviteCode } = request.params as { instanceId: string; inviteCode: string };
    return { success: true, data: await getConnectedClient(server, instanceId).getGroupInviteInfo(inviteCode) };
  });

  server.post('/instances/:instanceId/group-memberships', {
    schema: {
      tags: ['Groups'],
      summary: 'Join group using invite',
      params: instanceParams,
      body: {
        type: 'object',
        required: ['inviteCode'],
        properties: { inviteCode: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const { inviteCode } = request.body as { inviteCode: string };
    if (!inviteCode) throw new BadRequestError('inviteCode is required');
    const groupJid = await getConnectedClient(server, instanceId).acceptGroupInvite(inviteCode);
    return reply.status(201).send({ success: true, data: { groupJid } });
  });
}
