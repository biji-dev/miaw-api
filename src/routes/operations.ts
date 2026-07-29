import type { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth.js';
import { getClient, getConnectedClient } from '../utils/client.js';

const params = { type: 'object', required: ['instanceId'], properties: { instanceId: { type: 'string' } } };

export async function operationRoutes(server: FastifyInstance): Promise<void> {
  server.addHook('onRequest', createAuthMiddleware());

  server.get('/instances/:instanceId/runtime', { schema: { tags: ['Operations'], summary: 'Get client runtime settings', params } }, async (request) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const client = getClient(server, id);
    return { success: true, data: {
      connectionState: client.getConnectionState(), connected: client.isConnected(),
      debug: client.isDebugEnabled(), syncEnabled: client.isSyncEnabled(), proxy: client.getProxyInfo(),
    } };
  });

  server.patch('/instances/:instanceId/runtime', { schema: { tags: ['Operations'], summary: 'Update runtime toggles', params, body: {
    type: 'object', additionalProperties: false, properties: { debug: { type: 'boolean' }, syncEnabled: { type: 'boolean' } },
  } } }, async (request) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const body = request.body as { debug?: boolean; syncEnabled?: boolean };
    const client = getClient(server, id);
    if (body.debug !== undefined) client.setDebug(body.debug);
    if (body.syncEnabled === true) client.enableSync();
    if (body.syncEnabled === false) client.disableSync();
    return { success: true, data: { debug: client.isDebugEnabled(), syncEnabled: client.isSyncEnabled(), proxy: client.getProxyInfo() } };
  });

  server.get('/instances/:instanceId/lids', { schema: { tags: ['Operations'], summary: 'List LID mappings', params } }, async (request) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const client = getClient(server, id);
    const items = Object.entries(client.getLidMappings()).map(([lid, phoneJid]) => ({
      lid,
      phoneJid,
    }));
    return { success: true, data: { items, total: items.length } };
  });
  server.delete('/instances/:instanceId/lids', { schema: { tags: ['Operations'], summary: 'Clear LID cache', params } }, async (request) => {
    const { instanceId: id } = request.params as { instanceId: string };
    getClient(server, id).clearLidCache();
    return { success: true, data: { size: 0 } };
  });
  server.put('/instances/:instanceId/lids/:lid', { schema: { tags: ['Operations'], summary: 'Register LID mapping', params: {
    type: 'object', required: ['instanceId', 'lid'], properties: { instanceId: { type: 'string' }, lid: { type: 'string' } },
  }, body: {
    type: 'object', required: ['phoneJid'], properties: { phoneJid: { type: 'string' } },
  } } }, async (request) => {
    const { instanceId: id, lid } = request.params as { instanceId: string; lid: string };
    const { phoneJid } = request.body as { phoneJid: string };
    const client = getClient(server, id);
    client.registerLidMapping(lid, phoneJid);
    return { success: true, data: { lid, phoneJid } };
  });
  server.get('/instances/:instanceId/lids/:lid', { schema: { tags: ['Operations'], summary: 'Resolve LID to phone', params: {
    type: 'object', required: ['instanceId', 'lid'], properties: { instanceId: { type: 'string' }, lid: { type: 'string' } },
  } } }, async (request) => {
    const { instanceId: id, lid } = request.params as { instanceId: string; lid: string };
    const client = getConnectedClient(server, id);
    const jid = await client.resolveLidToJidAsync(lid);
    return { success: true, data: { lid, jid, phone: await client.getPhoneFromJidAsync(jid) } };
  });
  server.post('/instances/:instanceId/lid-resolutions', { schema: { tags: ['Operations'], summary: 'Resolve multiple LIDs', params, body: {
    type: 'object', required: ['lids'], properties: { lids: { type: 'array', minItems: 1, maxItems: 500, items: { type: 'string' } } },
  } } }, async (request) => {
    const { instanceId: id } = request.params as { instanceId: string };
    const { lids } = request.body as { lids: string[] };
    const resolved = await getConnectedClient(server, id).resolveLidsToPhones(lids);
    const items = Object.entries(resolved).map(([lid, phoneJid]) => ({ lid, phoneJid }));
    return { success: true, data: { items, total: items.length } };
  });
  server.get('/instances/:instanceId/phone-numbers/:phone/lid', { schema: { tags: ['Operations'], summary: 'Reverse-resolve phone to LID' } }, async (request) => {
    const { instanceId: id, phone } = request.params as { instanceId: string; phone: string };
    return { success: true, data: { phone, lid: await getConnectedClient(server, id).getLidForPhone(phone) } };
  });
}
