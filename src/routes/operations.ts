import type { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getClient, getConnectedClient } from '../utils/client.js';

const params = { type: 'object', required: ['id'], properties: { id: { type: 'string' } } };

export async function operationRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.get('/instances/:id/runtime', { schema: { tags: ['Operations'], summary: 'Get client runtime settings', params } }, async (request) => {
    const { id } = request.params as { id: string };
    const client = getClient(server, id);
    return { success: true, data: {
      connectionState: client.getConnectionState(), connected: client.isConnected(),
      debug: client.isDebugEnabled(), syncEnabled: client.isSyncEnabled(), proxy: client.getProxyInfo(),
    } };
  });

  server.patch('/instances/:id/runtime', { schema: { tags: ['Operations'], summary: 'Update runtime toggles', params, body: {
    type: 'object', additionalProperties: false, properties: { debug: { type: 'boolean' }, syncEnabled: { type: 'boolean' } },
  } } }, async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { debug?: boolean; syncEnabled?: boolean };
    const client = getClient(server, id);
    if (body.debug !== undefined) client.setDebug(body.debug);
    if (body.syncEnabled === true) client.enableSync();
    if (body.syncEnabled === false) client.disableSync();
    return { success: true, data: { debug: client.isDebugEnabled(), syncEnabled: client.isSyncEnabled(), proxy: client.getProxyInfo() } };
  });

  server.get('/instances/:id/lids', { schema: { tags: ['Operations'], summary: 'List LID mappings', params } }, async (request) => {
    const { id } = request.params as { id: string };
    const client = getClient(server, id);
    return { success: true, data: { size: client.getLidCacheSize(), mappings: client.getLidMappings() } };
  });
  server.delete('/instances/:id/lids', { schema: { tags: ['Operations'], summary: 'Clear LID cache', params } }, async (request) => {
    const { id } = request.params as { id: string };
    getClient(server, id).clearLidCache();
    return { success: true, data: { size: 0 } };
  });
  server.post('/instances/:id/lids/register', { schema: { tags: ['Operations'], summary: 'Register LID mapping', params, body: {
    type: 'object', required: ['lid', 'phoneJid'], properties: { lid: { type: 'string' }, phoneJid: { type: 'string' } },
  } } }, async (request) => {
    const { id } = request.params as { id: string };
    const { lid, phoneJid } = request.body as { lid: string; phoneJid: string };
    const client = getClient(server, id);
    client.registerLidMapping(lid, phoneJid);
    return { success: true, data: { lid, phoneJid } };
  });
  server.post('/instances/:id/lids/resolve', { schema: { tags: ['Operations'], summary: 'Resolve LID to phone', params, body: {
    type: 'object', required: ['lid'], properties: { lid: { type: 'string' } },
  } } }, async (request) => {
    const { id } = request.params as { id: string };
    const { lid } = request.body as { lid: string };
    const client = getConnectedClient(server, id);
    const jid = await client.resolveLidToJidAsync(lid);
    return { success: true, data: { lid, jid, phone: await client.getPhoneFromJidAsync(jid) } };
  });
  server.post('/instances/:id/lids/resolve-batch', { schema: { tags: ['Operations'], summary: 'Resolve multiple LIDs', params, body: {
    type: 'object', required: ['lids'], properties: { lids: { type: 'array', minItems: 1, maxItems: 500, items: { type: 'string' } } },
  } } }, async (request) => {
    const { id } = request.params as { id: string };
    const { lids } = request.body as { lids: string[] };
    return { success: true, data: await getConnectedClient(server, id).resolveLidsToPhones(lids) };
  });
  server.get('/instances/:id/lids/phone/:phone', { schema: { tags: ['Operations'], summary: 'Reverse-resolve phone to LID' } }, async (request) => {
    const { id, phone } = request.params as { id: string; phone: string };
    return { success: true, data: { phone, lid: await getConnectedClient(server, id).getLidForPhone(phone) } };
  });
}
