/**
 * Instance and proxy persistence across a restart.
 *
 * Losing an instance's proxy assignment means its next connect silently uses a
 * different egress IP, which WhatsApp reads as account takeover. That makes
 * surviving a restart a correctness property, not a convenience.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { startTestServer, stopTestServer, createTestClient } from './helpers/server.js';
import { uniqueInstanceId } from './helpers/ids.js';

describe('Instance persistence across restarts', () => {
  // `config` is a module singleton read at first import, so the session path
  // cannot be overridden per file - read back whatever the server actually used.
  let storeFile: string;
  const instanceId = uniqueInstanceId('persist');

  beforeAll(async () => {
    await startTestServer();
    const { config } = await import('../../src/config/index.js');
    storeFile = path.join(config.sessionPath, 'instances.json');
  }, 60000);

  afterAll(async () => {
    await stopTestServer();
  }, 30000);

  it('keeps an instance and its proxy after the server is restarted', async () => {
    const before = createTestClient();
    const created = await before.post('/api/v1/instances', {
      instanceId,
      webhookUrl: 'https://example.test/hook',
      webhookEvents: ['ready'],
      clientOptions: {
        proxy: {
          url: 'http://proxy.test:8080',
          username: 'region',
          password: 'secret',
        },
      },
    });
    expect(created.status).toBe(201);
    expect(created.data.data.proxy).toMatchObject({
      source: 'explicit',
      protocol: 'http',
      persisted: true,
    });

    await stopTestServer();
    await startTestServer();

    const after = createTestClient();
    const listed = await after.get('/api/v1/instances');
    expect(listed.status).toBe(200);

    const restored = listed.data.data.items.find(
      (item: { instanceId: string }) => item.instanceId === instanceId
    );
    expect(restored).toBeDefined();
    expect(restored.webhookUrl).toBe('https://example.test/hook');
    expect(restored.proxy).toMatchObject({
      source: 'explicit',
      protocol: 'http',
      downloadProxied: true,
      persisted: true,
    });

    // Restored, never auto-connected: reconnecting paired sessions in a burst
    // is a thundering herd, so it stays the operator's explicit decision.
    expect(restored.status).toBe('disconnected');

    // The password must not survive into any response.
    expect(JSON.stringify(listed.data)).not.toContain('secret');
    expect(restored.proxy.url).toContain('****');
  });

  it('writes the store owner-only, in the format miaw-cli shares', async () => {
    expect(fs.existsSync(storeFile)).toBe(true);
    expect(fs.statSync(storeFile).mode & 0o777).toBe(0o600);

    const stored = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
    expect(stored.version).toBe(1);
    expect(stored.instances[instanceId].proxy.url).toBe(
      'http://region:secret@proxy.test:8080/'
    );
  });

  it('drops the record when the instance is deleted', async () => {
    const client = createTestClient();
    const removed = await client.delete(`/api/v1/instances/${instanceId}`);
    expect(removed.status).toBe(200);

    const stored = JSON.parse(fs.readFileSync(storeFile, 'utf-8'));
    expect(stored.instances).not.toHaveProperty(instanceId);
  });
});
