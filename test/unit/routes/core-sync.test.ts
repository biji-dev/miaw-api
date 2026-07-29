import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MiawClient, MiawMessage } from 'miaw-core';
import type { InstanceManager } from '../../../src/services/InstanceManager.js';
import { config } from '../../../src/config/index.js';
import { registerSchemas } from '../../../src/schemas/index.js';
import { messagingRoutes } from '../../../src/routes/messaging.js';
import { advancedMessagingRoutes } from '../../../src/routes/advanced-messaging.js';
import { businessExtraRoutes } from '../../../src/routes/business-extras.js';
import { communityRoutes } from '../../../src/routes/communities.js';
import { operationRoutes } from '../../../src/routes/operations.js';
import { instanceRoutes } from '../../../src/routes/instances.js';

const storedMessage = {
  id: 'message-1', from: '6281@s.whatsapp.net', timestamp: 1,
  isGroup: false, fromMe: true, type: 'text', text: 'hello', raw: {},
} as MiawMessage;

describe('miaw-core 1.9.1 route contracts', () => {
  let server: FastifyInstance;
  let client: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    client = new Proxy({
      getMessageCounts: vi.fn(() => new Map([['6281@s.whatsapp.net', 1]])),
      getChatMessages: vi.fn(async () => ({ success: true, messages: [storedMessage] })),
      getConnectionState: vi.fn(() => 'connected'), isConnected: vi.fn(() => true),
      isDebugEnabled: vi.fn(() => false), isSyncEnabled: vi.fn(() => true),
      getProxyInfo: vi.fn(() => ({ url: 'http://***:***@proxy.test:8080', protocol: 'http:' })),
      getLidCacheSize: vi.fn(() => 0), getLidMappings: vi.fn(() => ({})),
    } as Record<string, ReturnType<typeof vi.fn>>, {
      get(target, property: string) {
        if (!target[property]) target[property] = vi.fn(async () => ({ success: true, messageId: 'new-message' }));
        return target[property];
      },
    });
    const manager = {
      getClient: vi.fn(() => client as unknown as MiawClient),
      getInstance: vi.fn(() => ({ status: 'connected' })),
      createInstance: vi.fn(async () => ({ instanceId: 'new', status: 'disconnected' })),
      listInstances: vi.fn(() => []),
    } as unknown as InstanceManager;
    server = Fastify({ logger: false });
    server.decorate('instanceManager', manager);
    registerSchemas(server);
    await server.register(instanceRoutes);
    await server.register(messagingRoutes);
    await server.register(advancedMessagingRoutes);
    await server.register(businessExtraRoutes);
    await server.register(communityRoutes);
    await server.register(operationRoutes);
    await server.ready();
  });

  afterEach(async () => server.close());

  const inject = (method: string, url: string, payload?: unknown) => server.inject({
    method, url, payload, headers: { authorization: `Bearer ${config.apiKey}` },
  });

  it('dispatches legacy generic media to the typed image method and resolves quotes', async () => {
    const response = await inject('POST', '/instances/test/send-media', {
      to: '6282', media: 'https://cdn.test/photo.jpg', quoted: 'message-1',
    });
    expect(response.statusCode).toBe(200);
    expect(client.sendImage).toHaveBeenCalledWith('6282', 'https://cdn.test/photo.jpg', expect.objectContaining({ quoted: storedMessage }));
  });

  it('requires a phone number for pairing-code authentication', async () => {
    const response = await inject('POST', '/instances', {
      instanceId: 'pairing', clientOptions: { usePairingCode: true },
    });
    expect(response.statusCode).toBe(400);
  });

  it('rejects generic media when its type cannot be inferred', async () => {
    const response = await inject('POST', '/instances/test/send-media', { to: '6282', media: 'https://cdn.test/download' });
    expect(response.statusCode).toBe(400);
    expect(client.sendImage).not.toHaveBeenCalled();
  });

  it('passes a stored message object to editMessage', async () => {
    const response = await inject('PATCH', '/instances/test/messages/edit', { messageId: 'message-1', text: 'updated' });
    expect(response.statusCode).toBe(200);
    expect(client.editMessage).toHaveBeenCalledWith(storedMessage, 'updated');
  });

  it('maps rich messaging to the new core methods', async () => {
    const response = await inject('POST', '/instances/test/messages/location', { to: '6282', latitude: -6.2, longitude: 106.8 });
    expect(response.statusCode).toBe(200);
    expect(client.sendLocation).toHaveBeenCalledWith('6282', -6.2, 106.8, expect.any(Object));
  });

  it('maps failed chat operations to a bad request instead of reporting success', async () => {
    client.muteChat.mockResolvedValueOnce({ success: false, error: 'app state unavailable' });
    const response = await inject('POST', '/instances/test/chats/6282%40s.whatsapp.net/mute', { durationMs: 5000 });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Mute chat failed',
    });
  });

  it('maps community participant operations to core', async () => {
    const response = await inject('POST', '/instances/test/communities/c@g.us/participants', { participants: ['6282'] });
    expect(response.statusCode).toBe(200);
    expect(client.addCommunityMembers).toHaveBeenCalledWith('c@g.us', ['6282']);
  });

  it('maps business profile updates to core', async () => {
    const response = await inject('PATCH', '/instances/test/business/profile', { address: 'Jakarta' });
    expect(response.statusCode).toBe(200);
    expect(client.updateBusinessProfile).toHaveBeenCalledWith({ address: 'Jakarta' });
  });

  it('returns only the proxy information already masked by core', async () => {
    const response = await inject('GET', '/instances/test/runtime');
    expect(response.statusCode).toBe(200);
    expect(response.json().data.proxy.url).toBe('http://***:***@proxy.test:8080');
  });

  it('registers all additive route groups', () => {
    for (const url of [
      '/instances/:id/messages/poll', '/instances/:id/statuses/text',
      '/instances/:id/chats/:jid/archive', '/instances/:id/business/quick-replies',
      '/instances/:id/communities/:communityJid/linked-groups', '/instances/:id/lids/resolve-batch',
    ]) {
      expect(server.hasRoute({ method: 'POST', url })).toBe(true);
    }
  });
});
