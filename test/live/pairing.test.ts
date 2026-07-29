import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { createTestClient, startTestServer, stopTestServer } from '../integration/helpers/server.js';
import { WebhookTestServer } from '../integration/helpers/webhook.js';
import { loadLiveTestConfig, type LiveTestConfig } from './config.js';

const describeLive = process.env.MIAW_RUN_LIVE_TESTS === 'true' ? describe : describe.skip;

describeLive('Isolated WhatsApp live release checks', () => {
  let config: LiveTestConfig;
  let client: ReturnType<typeof createTestClient>;
  let webhook: WebhookTestServer;
  let connected = false;
  let createdGroupJid: string | undefined;

  beforeAll(async () => {
    config = loadLiveTestConfig();
    process.env.MIAW_TEST_SESSION_PATH = `./test-sessions/${config.instanceId}`;
    await startTestServer();
    webhook = new WebhookTestServer(0);
    await webhook.start();
    client = createTestClient();

    const created = await client.post('/instances', {
      instanceId: config.instanceId,
      webhookUrl: webhook.getWebhookUrl(),
      webhookEvents: ['qr', 'pairing_code', 'ready', 'connection', 'disconnected', 'message_receipt', 'poll_vote', 'error'],
      clientOptions: config.authMode === 'pairing_code'
        ? { usePairingCode: true, phoneNumber: config.phone, debug: true, browser: ['Ubuntu', 'Chrome', '22.04.4'] }
        : { debug: true, browser: ['Ubuntu', 'Chrome', '22.04.4'] },
    });
    expect(created.status).toBe(201);

    expect((await client.post(`/instances/${config.instanceId}/connect`)).status).toBe(200);
    let ready = await webhook.waitForEvent('ready', 5000);
    if (!ready) {
      if (config.authMode === 'pairing_code') {
        const challenge = await webhook.waitForEvent('pairing_code', 60000);
        expect(challenge, 'Timed out waiting for a WhatsApp pairing code').not.toBeNull();
        const code = challenge?.data?.code;
        console.log(`\nEnter this WhatsApp pairing code for ${config.phone}: ${code}\n`);
        expect((await client.get(`/instances/${config.instanceId}/auth/pairing-code`)).data.data.code).toBe(code);
      } else {
        const challenge = await webhook.waitForEvent('qr', 60000);
        expect(challenge, 'Timed out waiting for a WhatsApp QR code').not.toBeNull();
        const qr = challenge?.data?.qr;
        const imagePath = `./test-sessions/${config.instanceId}/pairing-qr.png`;
        await QRCode.toFile(imagePath, qr, { width: 512, margin: 2 });
        console.log(await QRCode.toString(qr, { type: 'terminal', small: true }));
        console.log(`\nScan this WhatsApp QR image: ${imagePath}\n`);
        expect((await client.get(`/instances/${config.instanceId}/auth/qr`)).data.data.qr).toBe(qr);
      }
      ready = await webhook.waitForEvent('ready', 120000);
    }

    expect(ready, 'Timed out waiting for WhatsApp ready event').not.toBeNull();
    connected = true;
  });

  afterAll(async () => {
    if (createdGroupJid) await client.delete(`/instances/${config.instanceId}/groups/${encodeURIComponent(createdGroupJid)}`).catch(() => undefined);
    if (config?.instanceId) await client.delete(`/instances/${config.instanceId}`).catch(() => undefined);
    await webhook?.stop();
    await stopTestServer();
  });

  it('connects, exposes runtime state, and reconnects a persisted session', async () => {
    const status = await client.get(`/instances/${config.instanceId}/status`);
    expect(status.status).toBe(200);
    expect(status.data.data.status).toBe('connected');

    const runtime = await client.get(`/instances/${config.instanceId}/runtime`);
    expect(runtime.status).toBe(200);
    expect(runtime.data.data.connected).toBe(true);
    expect(webhook.getEventsByType('connection').length).toBeGreaterThan(0);
    expect(webhook.getEventsByType('ready').length).toBeGreaterThan(0);

    webhook.clearEvents();
    expect((await client.delete(`/instances/${config.instanceId}/disconnect`)).status).toBe(200);
    expect((await client.post(`/instances/${config.instanceId}/connect`)).status).toBe(200);
    expect(await webhook.waitForEvent('ready', 60000), 'Persisted session did not reconnect').not.toBeNull();
  });

  it('performs reversible messaging, contact, presence, and group operations', async () => {
    const contactJid = `${config.contactA}@s.whatsapp.net`;
    expect((await client.post(`/instances/${config.instanceId}/send-text`, { to: config.contactA, text: `miaw-api live ${config.instanceId}` })).status).toBe(200);
    expect((await client.post(`/instances/${config.instanceId}/send-media`, {
      to: config.contactA,
      media: webhook.getMediaFixtureUrl(),
      type: 'image',
      caption: `miaw-api live media ${config.instanceId}`,
    })).status).toBe(200);
    expect((await client.post(`/instances/${config.instanceId}/messages/location`, { to: config.contactA, latitude: -6.2088, longitude: 106.8456, name: 'Miaw API live test' })).status).toBe(200);
    expect((await client.post(`/instances/${config.instanceId}/messages/contact`, { to: config.contactA, contacts: [{ fullName: 'Miaw API Test', phone: config.contactB }] })).status).toBe(200);
    expect((await client.post(`/instances/${config.instanceId}/messages/poll`, { to: config.contactA, name: `miaw-api-${config.instanceId}`, options: ['pass', 'fail'] })).status).toBe(200);
    expect((await client.post(`/instances/${config.instanceId}/check-number`, { phone: config.contactA })).status).toBe(200);
    expect((await client.post(`/instances/${config.instanceId}/typing/${config.contactA}`)).status).toBe(200);
    expect((await client.post(`/instances/${config.instanceId}/stop-typing/${config.contactA}`)).status).toBe(200);

    expect((await client.get(`/instances/${config.instanceId}/profile`)).status).toBe(200);
    expect((await client.get(`/instances/${config.instanceId}/contacts/${encodeURIComponent(contactJid)}`)).status).toBe(200);
    expect((await client.get(`/instances/${config.instanceId}/chats`)).status).toBe(200);
    expect((await client.get(`/instances/${config.instanceId}/chats/${encodeURIComponent(contactJid)}/messages`)).status).toBe(200);

    const chatOperations = [
      await client.post(`/instances/${config.instanceId}/chats/${encodeURIComponent(contactJid)}/mute`, { durationMs: 5000 }),
      await client.delete(`/instances/${config.instanceId}/chats/${encodeURIComponent(contactJid)}/mute`),
    ];
    for (const response of chatOperations) {
      expect([200, 400]).toContain(response.status);
      if (response.status === 200) expect(response.data.data.success).not.toBe(false);
      if (response.status === 400) expect(response.data.error.code).toBe('INVALID_REQUEST');
    }
    console.log('Live chat-operation report:', chatOperations.map((response, index) => ({
      operation: ['mute', 'unmute'][index],
      status: response.status,
      body: response.data,
    })));

    const runtime = await client.get(`/instances/${config.instanceId}/runtime`);
    expect(runtime.status).toBe(200);
    expect((await client.patch(`/instances/${config.instanceId}/runtime`, { debug: !runtime.data.data.debug })).status).toBe(200);
    expect((await client.patch(`/instances/${config.instanceId}/runtime`, { debug: runtime.data.data.debug })).status).toBe(200);
    expect((await client.get(`/instances/${config.instanceId}/lids`)).status).toBe(200);
    expect((await client.get(`/instances/${config.instanceId}/lids/phone/${config.contactA}`)).status).toBe(200);

    const group = await client.post(`/instances/${config.instanceId}/groups`, { name: `miaw-api-${config.instanceId}`, participants: [config.contactA, config.contactB] });
    expect(group.status).toBe(200);
    createdGroupJid = group.data.data?.groupJid ?? group.data.data?.id ?? group.data.data?.jid;
    expect(createdGroupJid).toEqual(expect.any(String));
    expect((await client.delete(`/instances/${config.instanceId}/groups/${encodeURIComponent(createdGroupJid!)}`)).status).toBe(200);
    createdGroupJid = undefined;

    console.log('Live receipt-webhook report:', {
      supported: webhook.getEventsByType('message_receipt').length > 0,
      observedEvents: webhook.getEventsByType('message_receipt').length,
    });
  });

  it('probes explicitly supplied isolated group and community fixtures', async () => {
    if (config.groupJid) expect((await client.get(`/instances/${config.instanceId}/groups/${encodeURIComponent(config.groupJid)}`)).status).toBe(200);
    if (config.communityJid) expect((await client.get(`/instances/${config.instanceId}/communities/${encodeURIComponent(config.communityJid)}`)).status).toBe(200);
  });

  it('reports account-gated business and newsletter capabilities without hiding them', async () => {
    const probes = await Promise.all([
      client.get(`/instances/${config.instanceId}/labels`),
      client.get(`/instances/${config.instanceId}/newsletters/000000000000000@newsletter`, { timeout: 45000 }),
    ]);
    const report = [
      ...probes.map((response, index) => ({
        capability: ['labels', 'newsletter-metadata'][index],
        status: response.status as number | string,
        body: response.data,
      })),
      {
        capability: 'business-catalog',
        status: 'unverified',
        body: { reason: 'The isolated account has no confirmed WhatsApp Business catalog privileges' },
      },
    ];
    console.log('Live capability report:', report);
    for (const response of probes) expect(response.status).toBeLessThan(500);
  });
});
