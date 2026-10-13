/**
 * Test Server Setup
 * Starts and stops the API server for testing
 */

import type { FastifyInstance } from 'fastify';
import { HttpClient } from './http.js';

let apiServer: FastifyInstance | null = null;

// Override with MIAW_TEST_PORT when 3000 is taken by another local service.
export const TEST_PORT = Number(process.env.MIAW_TEST_PORT || 3000);
export const TEST_API_URL = `http://127.0.0.1:${TEST_PORT}`;

export async function startTestServer(): Promise<void> {
  if (apiServer) {
    return; // Already running
  }

  // Set test environment variables
  process.env.PORT = String(TEST_PORT);
  process.env.HOST = '127.0.0.1';
  process.env.API_KEY = 'test-api-key-for-integration-tests';
  process.env.WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.SESSION_PATH = process.env.MIAW_TEST_SESSION_PATH || './test-sessions';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

  const { createServer } = await import('../../../src/server.js');
  apiServer = await createServer();
  await apiServer.listen({ port: TEST_PORT, host: '127.0.0.1' });
}

export async function stopTestServer(): Promise<void> {
  if (apiServer) {
    await apiServer.close();
    apiServer = null;
  }
}

export function createTestClient(): HttpClient {
  return new HttpClient(
    TEST_API_URL,
    {
      'Authorization': 'Bearer test-api-key-for-integration-tests',
    },
    30000
  );
}
