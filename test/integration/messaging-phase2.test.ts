/**
 * Canonical v2 message mutation integration tests.
 *
 * Connected-account cases stay skipped here and are exercised by the isolated
 * live suite. Validation and disconnected-state behavior run in normal CI.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_CONFIG } from './fixtures/data.js';
import { createTestClient, startTestServer, stopTestServer } from './helpers/server.js';

describe('Message mutations', () => {
  let client: ReturnType<typeof createTestClient>;
  let instanceId: string;

  beforeAll(async () => startTestServer(), 30000);
  afterAll(async () => stopTestServer(), 10000);

  beforeEach(async () => {
    client = createTestClient();
    instanceId = `messages-${Date.now()}`;
    await client.post('/api/v1/instances', { instanceId });
  });

  afterEach(async () => {
    await client.delete(`/api/v1/instances/${instanceId}`).catch(() => undefined);
  });

  it.each([
    ['image', { image: 'https://example.com/image.jpg' }],
    ['video', { video: 'https://example.com/video.mp4' }],
    ['audio', { audio: 'https://example.com/audio.ogg' }],
    ['document', { document: 'https://example.com/document.pdf' }],
  ])('rejects %s sends while disconnected', async (kind, media) => {
    const response = await client.post(`/api/v1/instances/${instanceId}/messages/${kind}`, {
      to: TEST_CONFIG.TEST_CONTACT_A,
      ...media,
    });
    expect(response.status).toBe(503);
    expect(response.data.success).toBe(false);
  });

  it('validates typed media URLs', async () => {
    const response = await client.post(`/api/v1/instances/${instanceId}/messages/image`, {
      to: TEST_CONFIG.TEST_CONTACT_A,
      image: 'not-a-url',
    });
    expect(response.status).toBe(400);
  });

  it('uses the message identifier in the edit path', async () => {
    const response = await client.patch(
      `/api/v1/instances/${instanceId}/messages/message-id`,
      { text: 'edited' }
    );
    expect(response.status).toBe(503);
  });

  it('validates edit content before invoking the core client', async () => {
    const response = await client.patch(
      `/api/v1/instances/${instanceId}/messages/message-id`,
      { text: '' }
    );
    expect(response.status).toBe(400);
  });

  it('uses query state for message deletion', async () => {
    const response = await client.delete(
      `/api/v1/instances/${instanceId}/messages/message-id?scope=local&deleteMedia=false`
    );
    expect(response.status).toBe(503);
  });

  it('validates message deletion scope', async () => {
    const response = await client.delete(
      `/api/v1/instances/${instanceId}/messages/message-id?scope=invalid`
    );
    expect(response.status).toBe(400);
  });

  it('uses PUT and DELETE for reaction state', async () => {
    const add = await client.put(
      `/api/v1/instances/${instanceId}/messages/message-id/reaction`,
      { emoji: '👍' }
    );
    const remove = await client.delete(
      `/api/v1/instances/${instanceId}/messages/message-id/reaction`
    );
    expect(add.status).toBe(503);
    expect(remove.status).toBe(503);
  });

  it('uses the message identifier in the forward path', async () => {
    const response = await client.post(
      `/api/v1/instances/${instanceId}/messages/message-id/forward`,
      { to: [TEST_CONFIG.TEST_CONTACT_A] }
    );
    expect(response.status).toBe(503);
  });

  it('validates forward recipients', async () => {
    const response = await client.post(
      `/api/v1/instances/${instanceId}/messages/message-id/forward`,
      { to: [] }
    );
    expect(response.status).toBe(400);
  });

  it('uses POST with a body for chat history loading', async () => {
    const chatJid = encodeURIComponent(`${TEST_CONFIG.TEST_CONTACT_A}@s.whatsapp.net`);
    const response = await client.post(
      `/api/v1/instances/${instanceId}/chats/${chatJid}/message-history-loads`,
      { count: 20, timeoutMs: 10000 }
    );
    expect(response.status).toBe(503);
  });

  it.skip('sends, edits, reacts to, forwards, and removes a text message', async () => {
    const sent = await client.post(`/api/v1/instances/${instanceId}/messages/text`, {
      to: TEST_CONFIG.TEST_CONTACT_A,
      text: 'Canonical v2 message',
    });
    const messageId = sent.data.data.messageId;

    const edited = await client.patch(
      `/api/v1/instances/${instanceId}/messages/${messageId}`,
      { text: 'Canonical v2 edited message' }
    );
    const reacted = await client.put(
      `/api/v1/instances/${instanceId}/messages/${messageId}/reaction`,
      { emoji: '👍' }
    );
    const forwarded = await client.post(
      `/api/v1/instances/${instanceId}/messages/${messageId}/forward`,
      { to: [TEST_CONFIG.TEST_CONTACT_B] }
    );
    const removed = await client.delete(
      `/api/v1/instances/${instanceId}/messages/${messageId}?scope=everyone&deleteMedia=true`
    );

    for (const response of [sent, edited, reacted, forwarded, removed]) {
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data?.success).toBeUndefined();
    }
  });

  it.skip('sends and downloads typed media', async () => {
    const sent = await client.post(`/api/v1/instances/${instanceId}/messages/image`, {
      to: TEST_CONFIG.TEST_CONTACT_A,
      image: 'https://picsum.photos/300/200',
      caption: 'Canonical v2 image',
    });
    const downloaded = await client.get(
      `/api/v1/instances/${instanceId}/messages/${sent.data.data.messageId}/media`
    );
    expect(downloaded.status).toBe(200);
    expect(downloaded.data.data.contentBase64).toBeTypeOf('string');
  });
});
