/**
 * Test Server Setup
 * Starts and stops the API server for testing
 */

import type { FastifyInstance } from 'fastify';
import { HttpClient } from './http.js';

let apiServer: FastifyInstance | null = null;

export async function startTestServer(): Promise<void> {
  if (apiServer) {
    return; // Already running
  }

  // Set test environment variables
  process.env.PORT = '3000';
  process.env.HOST = '127.0.0.1';
  process.env.API_KEY = 'test-api-key-for-integration-tests';
  process.env.WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.SESSION_PATH = './test-sessions';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

  const { createServer } = await import('../../../src/server.js');
  apiServer = await createServer();
  await apiServer.listen({ port: 3000, host: '127.0.0.1' });
}

export async function stopTestServer(): Promise<void> {
  if (apiServer) {
    await apiServer.close();
    apiServer = null;
  }
}

export function createTestClient(): HttpClient {
  return new HttpClient(
    'http://127.0.0.1:3000',
    {
      'Authorization': 'Bearer test-api-key-for-integration-tests',
    },
    30000
  );
}
