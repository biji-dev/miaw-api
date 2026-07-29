/**
 * Basic GET Operations Tests (v2)
 *
 * Tests for:
 * - GET /api/v1/instances/:instanceId/contacts - Get all contacts
 * - GET /api/v1/instances/:instanceId/groups - Get all groups
 * - GET /api/v1/instances/:instanceId/profile - Get own profile
 * - GET /api/v1/instances/:instanceId/labels - Get all labels
 * - GET /api/v1/instances/:instanceId/chats - Get all chats
 * - GET /api/v1/instances/:instanceId/chats/:chatJid/messages - Get chat messages
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer } from './helpers/server.js';

const API_URL = 'http://127.0.0.1:3000';
const API_KEY = process.env.API_KEY || 'test-api-key-for-integration-tests';
const INSTANCE_ID = process.env.TEST_INSTANCE_ID || 'integration-test-bot';

describe('Basic GET Operations (v2)', () => {
  let isConnected = false;

  beforeAll(async () => {
    await startTestServer();
    // Check if instance is connected
    try {
      const response = await fetch(`${API_URL}/api/v1/instances/${INSTANCE_ID}/connection`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });
      const data = (await response.json()) as { data: { status: string } };
      isConnected = data.data.status === 'connected';
    } catch {
      // Skip if API is not available
    }
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe('GET /api/v1/instances/:instanceId/contacts - Get all contacts', () => {
    test('should return contacts list when instance is connected', async () => {
      if (!isConnected) {
        console.log('  ⚠️  Skipping: Instance not connected');
        return;
      }

      const response = await fetch(`${API_URL}/api/v1/instances/${INSTANCE_ID}/contacts`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        success: boolean;
        data: { items: unknown[]; total: number };
      };
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(data.data.total).toBe(data.data.items.length);
    });

    test('should return 404 for non-existent instance', async () => {
      const response = await fetch(`${API_URL}/api/v1/instances/non-existent/contacts`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      expect(response.status).toBe(404);

      const data = (await response.json()) as {
        success: boolean;
        error?: { message: string };
      };
      expect(data.success).toBe(false);
      expect(data.error?.message).toBe('Instance not found');
    });
  });

  describe('GET /api/v1/instances/:instanceId/groups - Get all groups', () => {
    test('should return groups list when instance is connected', async () => {
      if (!isConnected) {
        console.log('  ⚠️  Skipping: Instance not connected');
        return;
      }

      const response = await fetch(`${API_URL}/api/v1/instances/${INSTANCE_ID}/groups`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        success: boolean;
        data: { items: unknown[]; total: number };
      };
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(data.data.total).toBe(data.data.items.length);
    });

    test('should return 404 for non-existent instance', async () => {
      const response = await fetch(`${API_URL}/api/v1/instances/non-existent/groups`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      expect(response.status).toBe(404);

      const data = (await response.json()) as {
        success: boolean;
        error?: { message: string };
      };
      expect(data.success).toBe(false);
      expect(data.error?.message).toBe('Instance not found');
    });
  });

  describe('GET /api/v1/instances/:instanceId/profile - Get own profile', () => {
    test('should return own profile when instance is connected', async () => {
      if (!isConnected) {
        console.log('  ⚠️  Skipping: Instance not connected');
        return;
      }

      const response = await fetch(`${API_URL}/api/v1/instances/${INSTANCE_ID}/profile`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as { data: { jid?: string } };
      expect(data.data.jid).toBeDefined();
      expect(typeof data.data.jid).toBe('string');
    });

    test('should return 404 for non-existent instance', async () => {
      const response = await fetch(`${API_URL}/api/v1/instances/non-existent/profile`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      expect(response.status).toBe(404);

      const data = (await response.json()) as {
        success: boolean;
        error?: { message: string };
      };
      expect(data.success).toBe(false);
      expect(data.error?.message).toBe('Instance not found');
    });
  });

  describe('GET /api/v1/instances/:instanceId/labels - Get all labels', () => {
    test('should return labels list when instance is connected', async () => {
      if (!isConnected) {
        console.log('  ⚠️  Skipping: Instance not connected');
        return;
      }

      const response = await fetch(`${API_URL}/api/v1/instances/${INSTANCE_ID}/labels`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        success: boolean;
        data: { items: unknown[]; total: number };
      };
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(data.data.total).toBe(data.data.items.length);
    });

    test('should return 404 for non-existent instance', async () => {
      const response = await fetch(`${API_URL}/api/v1/instances/non-existent/labels`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      expect(response.status).toBe(404);

      const data = (await response.json()) as {
        success: boolean;
        error?: { message: string };
      };
      expect(data.success).toBe(false);
      expect(data.error?.message).toBe('Instance not found');
    });
  });

  describe('GET /api/v1/instances/:instanceId/chats - Get all chats', () => {
    test('should return chats list when instance is connected', async () => {
      if (!isConnected) {
        console.log('  ⚠️  Skipping: Instance not connected');
        return;
      }

      const response = await fetch(`${API_URL}/api/v1/instances/${INSTANCE_ID}/chats`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        success: boolean;
        data: { items: unknown[]; total: number };
      };
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(data.data.total).toBe(data.data.items.length);
    });

    test('should return 404 for non-existent instance', async () => {
      const response = await fetch(`${API_URL}/api/v1/instances/non-existent/chats`, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      expect(response.status).toBe(404);

      const data = (await response.json()) as {
        success: boolean;
        error?: { message: string };
      };
      expect(data.success).toBe(false);
      expect(data.error?.message).toBe('Instance not found');
    });
  });

  describe('GET /api/v1/instances/:instanceId/chats/:chatJid/messages - Get chat messages', () => {
    test('should return messages for a valid chat JID', async () => {
      if (!isConnected) {
        console.log('  ⚠️  Skipping: Instance not connected');
        return;
      }

      // Use status@whatsapp.net as a test JID (WhatsApp official account)
      const testJid = 'status@whatsapp.net';

      const response = await fetch(
        `${API_URL}/api/v1/instances/${INSTANCE_ID}/chats/${testJid}/messages`,
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
          },
        }
      );

      expect(response.status).toBe(200);

      const data = (await response.json()) as {
        success: boolean;
        data: { items: unknown[]; total: number };
      };
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(data.data.total).toBe(data.data.items.length);
    });

    test('should return 404 for non-existent instance', async () => {
      const response = await fetch(
        `${API_URL}/api/v1/instances/non-existent/chats/status@whatsapp.net/messages`,
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
          },
        }
      );

      expect(response.status).toBe(404);

      const data = (await response.json()) as {
        success: boolean;
        error?: { message: string };
      };
      expect(data.success).toBe(false);
      expect(data.error?.message).toBe('Instance not found');
    });
  });
});
