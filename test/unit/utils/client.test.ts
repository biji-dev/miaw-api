import { describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { MiawClient } from 'miaw-core';
import {
  findMessage,
  getClient,
  getConnectedClient,
  requireMessage,
  resolveQuote,
} from '../../../src/utils/client.js';

function serverWith(
  client: MiawClient | null,
  instance: { status: string } | null
): FastifyInstance {
  return {
    instanceManager: {
      getClient: vi.fn(() => client),
      getInstance: vi.fn(() => instance),
    },
  } as unknown as FastifyInstance;
}

describe('client route helpers', () => {
  it('rejects an instance without a client', () => {
    expect(() => getClient(serverWith(null, null), 'missing')).toThrow(
      'Instance not found'
    );
  });

  it('rejects a client whose instance is not connected', () => {
    const client = {} as MiawClient;
    expect(() =>
      getConnectedClient(serverWith(client, { status: 'disconnected' }), 'offline')
    ).toThrow('Instance is not connected');
  });

  it('does not resolve a quote when no message ID was supplied', async () => {
    await expect(resolveQuote({} as MiawClient)).resolves.toBeUndefined();
  });

  it('resolves a supplied quote from the requested chat', async () => {
    const message = { id: 'quoted-message' };
    const client = {
      getChatMessages: vi.fn(async () => ({ messages: [message] })),
    } as unknown as MiawClient;

    await expect(
      resolveQuote(client, 'quoted-message', '6281@s.whatsapp.net')
    ).resolves.toBe(message);
  });

  it('finds a message by scanning known chats when no chat was supplied', async () => {
    const message = { id: 'scanned-message' };
    const client = {
      getMessageCounts: vi.fn(() => new Map([['6281@s.whatsapp.net', 1]])),
      getChatMessages: vi.fn(async () => ({ messages: [message] })),
    } as unknown as MiawClient;

    await expect(findMessage(client, 'scanned-message')).resolves.toBe(message);
  });

  it('rejects a required message that does not exist', async () => {
    const client = {
      getChatMessages: vi.fn(async () => ({ messages: [] })),
    } as unknown as MiawClient;

    await expect(
      requireMessage(client, 'missing-message', '6281@s.whatsapp.net')
    ).rejects.toThrow('Message not found');
  });
});
