import type { FastifyInstance } from 'fastify';
import type { MiawClient, MiawMessage } from 'miaw-core';
import { NotFoundError, ServiceUnavailableError } from './errorHandler.js';

export function getClient(server: FastifyInstance, instanceId: string): MiawClient {
  const client = server.instanceManager.getClient(instanceId);
  if (!client || !server.instanceManager.getInstance(instanceId)) {
    throw new NotFoundError('Instance');
  }
  return client;
}

export function getConnectedClient(server: FastifyInstance, instanceId: string): MiawClient {
  const client = getClient(server, instanceId);
  if (server.instanceManager.getInstance(instanceId)?.status !== 'connected') {
    throw new ServiceUnavailableError('Instance is not connected');
  }
  return client;
}

export async function findMessage(
  client: MiawClient,
  messageId: string,
  chatJid?: string
): Promise<MiawMessage | null> {
  if (chatJid) {
    const result = await client.getChatMessages(chatJid);
    return result.messages?.find((message) => message.id === messageId) || null;
  }
  for (const jid of client.getMessageCounts().keys()) {
    const result = await client.getChatMessages(jid);
    const message = result.messages?.find((candidate) => candidate.id === messageId);
    if (message) return message;
  }
  return null;
}

export async function requireMessage(
  client: MiawClient,
  messageId: string,
  chatJid?: string
): Promise<MiawMessage> {
  const message = await findMessage(client, messageId, chatJid);
  if (!message) throw new NotFoundError('Message');
  return message;
}

export async function resolveQuote(
  client: MiawClient,
  messageId?: string,
  chatJid?: string
): Promise<MiawMessage | undefined> {
  return messageId ? requireMessage(client, messageId, chatJid) : undefined;
}

