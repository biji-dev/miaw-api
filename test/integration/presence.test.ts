/**
 * Canonical v2 presence integration tests.
 *
 * Mutating presence operations are intentionally skipped unless a connected
 * WhatsApp account is supplied by the isolated live-test configuration.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TEST_CONFIG } from './fixtures/data.js';
import { createTestClient, startTestServer, stopTestServer } from './helpers/server.js';

describe('Presence and read-state operations', () => {
  let client: ReturnType<typeof createTestClient>;
  let instanceId: string;
  const contactJid = `${TEST_CONFIG.TEST_CONTACT_A}@s.whatsapp.net`;

  beforeAll(async () => startTestServer(), 30000);
  afterAll(async () => stopTestServer(), 10000);

  beforeEach(async () => {
    client = createTestClient();
    instanceId = `presence-${Date.now()}`;
    await client.post('/api/v1/instances', { instanceId });
  });

  afterEach(async () => {
    await client.delete(`/api/v1/instances/${instanceId}`).catch(() => undefined);
  });

  it('rejects account presence changes while disconnected', async () => {
    const response = await client.put(`/api/v1/instances/${instanceId}/presence`, {
      status: 'available',
    });
    expect(response.status).toBe(503);
    expect(response.data.success).toBe(false);
  });

  it('validates account presence state', async () => {
    const response = await client.put(`/api/v1/instances/${instanceId}/presence`, {
      status: 'invalid',
    });
    expect(response.status).toBe(400);
  });

  it('requires account presence state', async () => {
    const response = await client.put(`/api/v1/instances/${instanceId}/presence`, {});
    expect(response.status).toBe(400);
  });

  it('rejects chat presence changes while disconnected', async () => {
    const response = await client.put(
      `/api/v1/instances/${instanceId}/chats/${encodeURIComponent(contactJid)}/presence`,
      { state: 'typing' }
    );
    expect(response.status).toBe(503);
  });

  it('validates chat presence state', async () => {
    const response = await client.put(
      `/api/v1/instances/${instanceId}/chats/${encodeURIComponent(contactJid)}/presence`,
      { state: 'invalid' }
    );
    expect(response.status).toBe(400);
  });

  it('rejects read receipts while disconnected', async () => {
    const response = await client.put(
      `/api/v1/instances/${instanceId}/messages/test-message/read-receipt?chatJid=${encodeURIComponent(contactJid)}`
    );
    expect(response.status).toBe(503);
  });

  it('allows message lookup without a chat hint', async () => {
    const response = await client.put(
      `/api/v1/instances/${instanceId}/messages/test-message/read-receipt`
    );
    expect(response.status).toBe(503);
  });

  it('rejects presence subscriptions while disconnected', async () => {
    const response = await client.put(
      `/api/v1/instances/${instanceId}/contacts/${encodeURIComponent(contactJid)}/presence-subscription`
    );
    expect(response.status).toBe(503);
  });

  it.skip('sets account availability on an isolated connected account', async () => {
    const available = await client.put(`/api/v1/instances/${instanceId}/presence`, {
      status: 'available',
    });
    const unavailable = await client.put(`/api/v1/instances/${instanceId}/presence`, {
      status: 'unavailable',
    });
    expect(available.status).toBe(200);
    expect(unavailable.status).toBe(200);
  });

  it.skip('sets typing, recording, and paused chat presence', async () => {
    const url =
      `/api/v1/instances/${instanceId}/chats/${encodeURIComponent(contactJid)}/presence`;
    for (const state of ['typing', 'recording', 'paused']) {
      const response = await client.put(url, { state });
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.state).toBe(state);
    }
  });

  it.skip('sends a read receipt and subscribes to contact presence', async () => {
    const receipt = await client.put(
      `/api/v1/instances/${instanceId}/messages/test-message/read-receipt?chatJid=${encodeURIComponent(contactJid)}`
    );
    const subscription = await client.put(
      `/api/v1/instances/${instanceId}/contacts/${encodeURIComponent(contactJid)}/presence-subscription`
    );
    expect(receipt.status).toBe(200);
    expect(subscription.status).toBe(200);
  });
});
