import type { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth.js';
import { BadRequestError } from '../utils/errorHandler.js';
import { getConnectedClient } from '../utils/client.js';

const idParams = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };
const membersBody = { type: 'object', required: ['participants'], properties: { participants: { type: 'array', minItems: 1, items: { type: 'string' } } } };

export async function communityRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.get('/instances/:id/communities', { schema: { tags: ['Communities'], summary: 'List communities', params: idParams } }, async (request) => {
    const { id } = request.params as { id: string };
    return { success: true, data: await getConnectedClient(server, id).getAllCommunities() };
  });
  server.post('/instances/:id/communities', { schema: { tags: ['Communities'], summary: 'Create community', params: idParams, body: {
    type: 'object', required: ['name'], properties: { name: { type: 'string' }, description: { type: 'string' } },
  } } }, async (request) => {
    const { id } = request.params as { id: string };
    const { name, description } = request.body as { name: string; description?: string };
    return { success: true, data: await getConnectedClient(server, id).createCommunity(name, description) };
  });
  server.get('/instances/:id/communities/:communityJid', { schema: { tags: ['Communities'], summary: 'Get community' } }, async (request) => {
    const { id, communityJid } = request.params as { id: string; communityJid: string };
    return { success: true, data: await getConnectedClient(server, id).getCommunityInfo(communityJid) };
  });
  server.patch('/instances/:id/communities/:communityJid', { schema: { tags: ['Communities'], summary: 'Update community', body: {
    type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, description: { type: ['string', 'null'] } },
  } } }, async (request) => {
    const { id, communityJid } = request.params as { id: string; communityJid: string };
    const body = request.body as { name?: string; description?: string | null };
    if (body.name === undefined && body.description === undefined) throw new BadRequestError('Provide name or description');
    const client = getConnectedClient(server, id);
    const results = [];
    if (body.name !== undefined) results.push(await client.updateCommunityName(communityJid, body.name));
    if (body.description !== undefined) results.push(await client.updateCommunityDescription(communityJid, body.description || undefined));
    return { success: true, data: results };
  });
  server.delete('/instances/:id/communities/:communityJid', { schema: { tags: ['Communities'], summary: 'Leave community' } }, async (request) => {
    const { id, communityJid } = request.params as { id: string; communityJid: string };
    return { success: true, data: await getConnectedClient(server, id).leaveCommunity(communityJid) };
  });
  server.get('/instances/:id/communities/:communityJid/participants', { schema: { tags: ['Communities'], summary: 'Get community participants' } }, async (request) => {
    const { id, communityJid } = request.params as { id: string; communityJid: string };
    return { success: true, data: await getConnectedClient(server, id).getCommunityParticipants(communityJid) };
  });

  const memberActions = [
    ['POST', 'participants', 'addCommunityMembers'],
    ['DELETE', 'participants', 'removeCommunityMembers'],
    ['POST', 'admins', 'promoteCommunityMembers'],
    ['DELETE', 'admins', 'demoteCommunityMembers'],
  ] as const;
  for (const [method, path, operation] of memberActions) {
    server.route({ method, url: `/instances/:id/communities/:communityJid/${path}`, schema: { tags: ['Communities'], summary: `${operation}`, body: membersBody }, handler: async (request) => {
      const { id, communityJid } = request.params as { id: string; communityJid: string };
      const { participants } = request.body as { participants: string[] };
      const client = getConnectedClient(server, id);
      return { success: true, data: await client[operation](communityJid, participants) };
    } });
  }

  server.post('/instances/:id/communities/:communityJid/groups', { schema: { tags: ['Communities'], summary: 'Create group inside community', body: {
    type: 'object', required: ['name'], properties: { name: { type: 'string' }, participants: { type: 'array', items: { type: 'string' } } },
  } } }, async (request) => {
    const { id, communityJid } = request.params as { id: string; communityJid: string };
    const { name, participants } = request.body as { name: string; participants?: string[] };
    return { success: true, data: await getConnectedClient(server, id).createCommunityGroup(communityJid, name, participants) };
  });
  server.get('/instances/:id/communities/:communityJid/linked-groups', { schema: { tags: ['Communities'], summary: 'List linked groups' } }, async (request) => {
    const { id, communityJid } = request.params as { id: string; communityJid: string };
    return { success: true, data: await getConnectedClient(server, id).getLinkedGroups(communityJid) };
  });
  server.post('/instances/:id/communities/:communityJid/linked-groups', { schema: { tags: ['Communities'], summary: 'Link group to community', body: {
    type: 'object', required: ['groupJid'], properties: { groupJid: { type: 'string' } },
  } } }, async (request) => {
    const { id, communityJid } = request.params as { id: string; communityJid: string };
    const { groupJid } = request.body as { groupJid: string };
    return { success: true, data: await getConnectedClient(server, id).linkGroupToCommunity(groupJid, communityJid) };
  });
  server.delete('/instances/:id/communities/:communityJid/linked-groups/:groupJid', { schema: { tags: ['Communities'], summary: 'Unlink group from community' } }, async (request) => {
    const { id, communityJid, groupJid } = request.params as { id: string; communityJid: string; groupJid: string };
    return { success: true, data: await getConnectedClient(server, id).unlinkGroupFromCommunity(groupJid, communityJid) };
  });

  server.get('/instances/:id/communities/:communityJid/invite', { schema: { tags: ['Communities'], summary: 'Get community invite link' } }, async (request) => {
    const { id, communityJid } = request.params as { id: string; communityJid: string };
    return { success: true, data: { inviteLink: await getConnectedClient(server, id).getCommunityInviteLink(communityJid) } };
  });
  server.post('/instances/:id/communities/:communityJid/revoke-invite', { schema: { tags: ['Communities'], summary: 'Revoke community invite' } }, async (request) => {
    const { id, communityJid } = request.params as { id: string; communityJid: string };
    return { success: true, data: { inviteLink: await getConnectedClient(server, id).revokeCommunityInvite(communityJid) } };
  });
  server.get('/instances/:id/communities/invite/:code/info', { schema: { tags: ['Communities'], summary: 'Get community invite info' } }, async (request) => {
    const { id, code } = request.params as { id: string; code: string };
    return { success: true, data: await getConnectedClient(server, id).getCommunityInviteInfo(code) };
  });
  server.post('/instances/:id/communities/join/:inviteCode', { schema: { tags: ['Communities'], summary: 'Join community by invite' } }, async (request) => {
    const { id, inviteCode } = request.params as { id: string; inviteCode: string };
    return { success: true, data: { communityJid: await getConnectedClient(server, id).acceptCommunityInvite(inviteCode) } };
  });
}
