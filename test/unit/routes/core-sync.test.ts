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
import { newsletterRoutes } from '../../../src/routes/newsletters.js';
import { operationRoutes } from '../../../src/routes/operations.js';
import { instanceRoutes } from '../../../src/routes/instances.js';
import { presenceRoutes } from '../../../src/routes/presence.js';
import { normalizeContactId } from '../../../src/routes/contacts.js';
import { requireCoreSuccess } from '../../../src/utils/client.js';

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
    await server.register(instanceRoutes, { prefix: '/api/v1' });
    await server.register(messagingRoutes, { prefix: '/api/v1' });
    await server.register(advancedMessagingRoutes, { prefix: '/api/v1' });
    await server.register(businessExtraRoutes, { prefix: '/api/v1' });
    await server.register(communityRoutes, { prefix: '/api/v1' });
    await server.register(newsletterRoutes, { prefix: '/api/v1' });
    await server.register(operationRoutes, { prefix: '/api/v1' });
    await server.register(presenceRoutes, { prefix: '/api/v1' });
    await server.ready();
  });

  afterEach(async () => server.close());

  const inject = (method: string, url: string, payload?: unknown) => server.inject({
    method, url, payload, headers: { authorization: `Bearer ${config.apiKey}` },
  });

  it('removes the legacy generic media endpoint', async () => {
    const response = await inject('POST', '/api/v1/instances/test/send-media', {
      to: '6282', media: 'https://cdn.test/photo.jpg', quoted: 'message-1',
    });
    expect(response.statusCode).toBe(404);
    expect(client.sendImage).not.toHaveBeenCalled();
  });

  it('requires a phone number for pairing-code authentication', async () => {
    const response = await inject('POST', '/api/v1/instances', {
      instanceId: 'pairing', clientOptions: { usePairingCode: true },
    });
    expect(response.statusCode).toBe(400);
  });

  it('normalizes contact phone numbers and preserves JIDs', () => {
    expect(normalizeContactId('6281234567890')).toEqual({
      phone: '6281234567890',
      jid: '6281234567890@s.whatsapp.net',
    });
    expect(normalizeContactId('6281234567890@s.whatsapp.net')).toEqual({
      phone: '6281234567890',
      jid: '6281234567890@s.whatsapp.net',
    });
    expect(() => normalizeContactId('not a contact')).toThrow();
  });

  it('strips nested core success and translates core failures', () => {
    expect(requireCoreSuccess({ success: true, value: 1 }, 'Test')).toEqual({ value: 1 });
    expect(() => requireCoreSuccess({ success: false, error: 'rejected' }, 'Test')).toThrow(
      'Test failed'
    );
  });

  it('keeps every generic media request removed', async () => {
    const response = await inject('POST', '/api/v1/instances/test/send-media', { to: '6282', media: 'https://cdn.test/download' });
    expect(response.statusCode).toBe(404);
    expect(client.sendImage).not.toHaveBeenCalled();
  });

  it('passes a stored message object to editMessage', async () => {
    const response = await inject('PATCH', '/api/v1/instances/test/messages/message-1', { text: 'updated' });
    expect(response.statusCode).toBe(200);
    expect(client.editMessage).toHaveBeenCalledWith(storedMessage, 'updated');
  });

  it('maps failed message operations to a bad request', async () => {
    client.editMessage.mockResolvedValueOnce({ success: false, error: 'edit rejected' });
    const response = await inject(
      'PATCH',
      '/api/v1/instances/test/messages/message-1',
      { text: 'updated' }
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe('Edit message failed');
  });

  it('maps rich messaging to the new core methods', async () => {
    const response = await inject('POST', '/api/v1/instances/test/messages/location', { to: '6282', latitude: -6.2, longitude: 106.8 });
    expect(response.statusCode).toBe(200);
    expect(client.sendLocation).toHaveBeenCalledWith('6282', -6.2, 106.8, expect.any(Object));
  });

  it('maps failed chat operations to a bad request instead of reporting success', async () => {
    client.muteChat.mockResolvedValueOnce({ success: false, error: 'app state unavailable' });
    const response = await inject('PUT', '/api/v1/instances/test/chats/6282%40s.whatsapp.net/mute', { durationMs: 5000 });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Mute chat failed',
    });
  });

  it('maps community participant operations to core', async () => {
    const response = await inject('PATCH', '/api/v1/instances/test/communities/c@g.us/participants', {
      operation: 'add', participants: ['6282'],
    });
    expect(response.statusCode).toBe(200);
    expect(client.addCommunityMembers).toHaveBeenCalledWith('c@g.us', ['6282']);
  });

  it('returns 201 for community creation', async () => {
    const response = await inject(
      'POST',
      '/api/v1/instances/test/communities',
      { name: 'Community' }
    );
    expect(response.statusCode).toBe(201);
    expect(response.json().data.success).toBeUndefined();
  });

  it('normalizes community and LID collections', async () => {
    client.getCommunityParticipants.mockResolvedValueOnce([{ id: 'member@lid' }]);
    client.getLinkedGroups.mockResolvedValueOnce([{ id: 'group@g.us' }]);
    client.getLidMappings.mockReturnValueOnce({ 'member@lid': '6281@s.whatsapp.net' });

    const participants = await inject(
      'GET',
      '/api/v1/instances/test/communities/community@g.us/participants'
    );
    const linkedGroups = await inject(
      'GET',
      '/api/v1/instances/test/communities/community@g.us/linked-groups'
    );
    const lids = await inject('GET', '/api/v1/instances/test/lids');

    expect(participants.json().data).toEqual({
      items: [{ id: 'member@lid' }],
      total: 1,
    });
    expect(linkedGroups.json().data).toEqual({
      items: [{ id: 'group@g.us' }],
      total: 1,
    });
    expect(lids.json().data).toEqual({
      items: [{ lid: 'member@lid', phoneJid: '6281@s.whatsapp.net' }],
      total: 1,
    });
  });

  it('maps failed community operations to a bad request', async () => {
    client.addCommunityMembers.mockResolvedValueOnce({ success: false, error: 'membership rejected' });
    const response = await inject(
      'PATCH',
      '/api/v1/instances/test/communities/c@g.us/participants',
      { operation: 'add', participants: ['6282'] }
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe('add community participants failed');
  });

  it('maps business profile updates to core', async () => {
    const response = await inject('PATCH', '/api/v1/instances/test/business/profile', { address: 'Jakarta' });
    expect(response.statusCode).toBe(200);
    expect(client.updateBusinessProfile).toHaveBeenCalledWith({ address: 'Jakarta' });
  });

  it('maps failed business operations to a bad request', async () => {
    client.updateBusinessProfile.mockResolvedValueOnce({ success: false, error: 'profile rejected' });
    const response = await inject(
      'PATCH',
      '/api/v1/instances/test/business/profile',
      { address: 'Jakarta' }
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe('Update business profile failed');
  });

  it('maps failed newsletter operations to a bad request', async () => {
    client.updateNewsletterName.mockResolvedValueOnce({ success: false, error: 'name rejected' });
    const response = await inject(
      'PATCH',
      '/api/v1/instances/test/newsletters/channel@newsletter',
      { name: 'New name' }
    );
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toBe('Update newsletter name failed');
  });

  it('uses stored messages and query hints for read receipts', async () => {
    client.markAsRead.mockResolvedValueOnce(true);
    const response = await inject(
      'PUT',
      '/api/v1/instances/test/messages/message-1/read-receipt?chatJid=6281%40s.whatsapp.net'
    );
    expect(response.statusCode).toBe(200);
    expect(client.getChatMessages).toHaveBeenCalledWith('6281@s.whatsapp.net');
    expect(client.markAsRead).toHaveBeenCalledWith(storedMessage);
  });

  it('normalizes phone contact IDs before presence subscription', async () => {
    const response = await inject(
      'PUT',
      '/api/v1/instances/test/contacts/6281234567890/presence-subscription'
    );
    expect(response.statusCode).toBe(200);
    expect(client.subscribePresence).toHaveBeenCalledWith('6281234567890@s.whatsapp.net');
  });

  it('returns only the proxy information already masked by core', async () => {
    const response = await inject('GET', '/api/v1/instances/test/runtime');
    expect(response.statusCode).toBe(200);
    expect(response.json().data.proxy.url).toBe('http://***:***@proxy.test:8080');
  });

  it('registers all additive route groups', () => {
    expect(server.hasRoute({ method: 'POST', url: '/api/v1/instances/:instanceId/messages/poll' })).toBe(true);
    expect(server.hasRoute({ method: 'POST', url: '/api/v1/instances/:instanceId/statuses/text' })).toBe(true);
    expect(server.hasRoute({ method: 'PUT', url: '/api/v1/instances/:instanceId/chats/:chatJid/archive' })).toBe(true);
    expect(server.hasRoute({ method: 'POST', url: '/api/v1/instances/:instanceId/business/quick-replies' })).toBe(true);
    expect(server.hasRoute({ method: 'PUT', url: '/api/v1/instances/:instanceId/communities/:communityJid/linked-groups' })).toBe(true);
    expect(server.hasRoute({ method: 'POST', url: '/api/v1/instances/:instanceId/lid-resolutions' })).toBe(true);
  });
});
