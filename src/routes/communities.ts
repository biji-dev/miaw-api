import type { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth.js';
import { BadRequestError } from '../utils/errorHandler.js';
import { getConnectedClient, requireCoreSuccess } from '../utils/client.js';

const idParams = { type: 'object', required: ['instanceId'], properties: { instanceId: { type: 'string' } } };
const membersBody = { type: 'object', required: ['participants'], properties: { participants: { type: 'array', minItems: 1, items: { type: 'string' } } } };

export async function communityRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.get('/instances/:instanceId/communities', { schema: { tags: ['Communities'], summary: 'List communities', params: idParams } }, async (request) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const items = await getConnectedClient(server, id).getAllCommunities();
    return { success: true, data: { items, total: items.length } };
  });
  server.post('/instances/:instanceId/communities', { schema: { tags: ['Communities'], summary: 'Create community', params: idParams, body: {
    type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' } },
  } } }, async (request, reply) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const { name, description } = request.body as { name: string; description?: string };
    const data = requireCoreSuccess(
      await getConnectedClient(server, id).createCommunity(name, description),
      'Create community'
    );
    return reply.status(201).send({ success: true, data });
  });
  server.get('/instances/:instanceId/communities/:communityJid', { schema: { tags: ['Communities'], summary: 'Get community' } }, async (request) => {
    const { instanceId: id, communityJid } = request.params as { instanceId: string; communityJid: string };
    return { success: true, data: await getConnectedClient(server, id).getCommunityInfo(communityJid) };
  });
  server.patch('/instances/:instanceId/communities/:communityJid', { schema: { tags: ['Communities'], summary: 'Update community', body: {
    type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, description: { type: ['string', 'null'] } },
  } } }, async (request) => {
    const { instanceId: id, communityJid } = request.params as { instanceId: string; communityJid: string };
    const body = request.body as { name?: string; description?: string | null };
    if (body.name === undefined && body.description === undefined) throw new BadRequestError('Provide name or description');
    const client = getConnectedClient(server, id);
    const results = [];
    if (body.name !== undefined) results.push(requireCoreSuccess(await client.updateCommunityName(communityJid, body.name), 'Update community name'));
    if (body.description !== undefined) results.push(requireCoreSuccess(await client.updateCommunityDescription(communityJid, body.description || undefined), 'Update community description'));
    return { success: true, data: results };
  });
  server.delete('/instances/:instanceId/communities/:communityJid', { schema: { tags: ['Communities'], summary: 'Leave community' } }, async (request) => {
    const { instanceId: id, communityJid } = request.params as { instanceId: string; communityJid: string };
    const result = await getConnectedClient(server, id).leaveCommunity(communityJid);
    return { success: true, data: requireCoreSuccess(result, 'Leave community') };
  });
  server.get('/instances/:instanceId/communities/:communityJid/participants', { schema: { tags: ['Communities'], summary: 'Get community participants' } }, async (request) => {
    const { instanceId: id, communityJid } = request.params as { instanceId: string; communityJid: string };
    const items = await getConnectedClient(server, id).getCommunityParticipants(communityJid) ?? [];
    return { success: true, data: { items, total: items.length } };
  });

  server.patch('/instances/:instanceId/communities/:communityJid/participants', { schema: { tags: ['Communities'], summary: 'Change community participants', body: {
    ...membersBody,
    required: ['operation', 'participants'],
    properties: {
      operation: { type: 'string', enum: ['add', 'remove', 'promote', 'demote'] },
      participants: { type: 'array', minItems: 1, items: { type: 'string' } },
    },
  } } }, async (request) => {
    const { instanceId: id, communityJid } = request.params as { instanceId: string; communityJid: string };
    const { operation, participants } = request.body as { operation: 'add' | 'remove' | 'promote' | 'demote'; participants: string[] };
    const client = getConnectedClient(server, id);
    const result = operation === 'add'
      ? await client.addCommunityMembers(communityJid, participants)
      : operation === 'remove'
        ? await client.removeCommunityMembers(communityJid, participants)
        : operation === 'promote'
          ? await client.promoteCommunityMembers(communityJid, participants)
          : await client.demoteCommunityMembers(communityJid, participants);
    return { success: true, data: requireCoreSuccess(result, `${operation} community participants`) };
  });

  server.post('/instances/:instanceId/communities/:communityJid/groups', { schema: { tags: ['Communities'], summary: 'Create group inside community', body: {
    type: 'object', required: ['name'], properties: { name: { type: 'string' }, participants: { type: 'array', items: { type: 'string' } } },
  } } }, async (request, reply) => {
    const { instanceId: id, communityJid } = request.params as { instanceId: string; communityJid: string };
    const { name, participants } = request.body as { name: string; participants?: string[] };
    const result = await getConnectedClient(server, id).createCommunityGroup(communityJid, name, participants);
    return reply.status(201).send({
      success: true,
      data: requireCoreSuccess(result, 'Create community group'),
    });
  });
  server.get('/instances/:instanceId/communities/:communityJid/linked-groups', { schema: { tags: ['Communities'], summary: 'List linked groups' } }, async (request) => {
    const { instanceId: id, communityJid } = request.params as { instanceId: string; communityJid: string };
    const items = await getConnectedClient(server, id).getLinkedGroups(communityJid);
    return { success: true, data: { items, total: items.length } };
  });
  server.put('/instances/:instanceId/communities/:communityJid/linked-groups', { schema: { tags: ['Communities'], summary: 'Link group to community', body: {
    type: 'object', required: ['groupJid'], properties: { groupJid: { type: 'string' } },
  } } }, async (request) => {
    const { instanceId: id, communityJid } = request.params as { instanceId: string; communityJid: string };
    const { groupJid } = request.body as { groupJid: string };
    const result = await getConnectedClient(server, id).linkGroupToCommunity(groupJid, communityJid);
    return { success: true, data: requireCoreSuccess(result, 'Link group to community') };
  });
  server.delete('/instances/:instanceId/communities/:communityJid/linked-groups/:groupJid', { schema: { tags: ['Communities'], summary: 'Unlink group from community' } }, async (request) => {
    const { instanceId: id, communityJid, groupJid } = request.params as { instanceId: string; communityJid: string; groupJid: string };
    const result = await getConnectedClient(server, id).unlinkGroupFromCommunity(groupJid, communityJid);
    return { success: true, data: requireCoreSuccess(result, 'Unlink group from community') };
  });

  server.get('/instances/:instanceId/communities/:communityJid/invite', { schema: { tags: ['Communities'], summary: 'Get community invite link' } }, async (request) => {
    const { instanceId: id, communityJid } = request.params as { instanceId: string; communityJid: string };
    return { success: true, data: { inviteLink: await getConnectedClient(server, id).getCommunityInviteLink(communityJid) } };
  });
  server.delete('/instances/:instanceId/communities/:communityJid/invite', { schema: { tags: ['Communities'], summary: 'Revoke community invite' } }, async (request) => {
    const { instanceId: id, communityJid } = request.params as { instanceId: string; communityJid: string };
    return { success: true, data: { inviteLink: await getConnectedClient(server, id).revokeCommunityInvite(communityJid) } };
  });
  server.get('/instances/:instanceId/community-invites/:inviteCode', { schema: { tags: ['Communities'], summary: 'Get community invite info' } }, async (request) => {
    const { instanceId: id, inviteCode } = request.params as { instanceId: string; inviteCode: string };
    return { success: true, data: await getConnectedClient(server, id).getCommunityInviteInfo(inviteCode) };
  });
  server.post('/instances/:instanceId/community-memberships', { schema: { tags: ['Communities'], summary: 'Join community by invite', body: {
    type: 'object', required: ['inviteCode'], properties: { inviteCode: { type: 'string' } },
  } } }, async (request, reply) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const { inviteCode } = request.body as { inviteCode: string };
    const communityJid = await getConnectedClient(server, id).acceptCommunityInvite(inviteCode);
    return reply.status(201).send({ success: true, data: { communityJid } });
  });
}
