/**
 * Basic GET Operations Routes (v0.9.0)
 *
 * GET endpoints for fetching contacts, groups, profile, labels, messages, and chats
 */

import { FastifyInstance } from 'fastify';
import { InstanceManager } from '../services/InstanceManager';

/**
 * Register basic GET operation routes
 */
export async function basicGetsRoutes(server: FastifyInstance, instanceManager: InstanceManager): Promise<void> {
  // ============================================================================
  // GET /instances/:id/contacts - Get all contacts
  // ============================================================================
  server.get('/instances/:instanceId/contacts', {
    schema: {
      params: {
        type: 'object',
        required: ['instanceId'],
        properties: {
          instanceId: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };

    const client = instanceManager.getClient(instanceId);
    if (!client) {
      return reply.code(404).send({
        success: false,
        error: 'Instance not found',
      });
    }

    const result = await client.fetchAllContacts();

    if (result.success) {
      return reply.send(result);
    }

    return reply.code(500).send(result);
  });

  // ============================================================================
  // GET /instances/:id/groups - Get all groups
  // ============================================================================
  server.get('/instances/:instanceId/groups', {
    schema: {
      params: {
        type: 'object',
        required: ['instanceId'],
        properties: {
          instanceId: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };

    const client = instanceManager.getClient(instanceId);
    if (!client) {
      return reply.code(404).send({
        success: false,
        error: 'Instance not found',
      });
    }

    const result = await client.fetchAllGroups();

    if (result.success) {
      return reply.send(result);
    }

    return reply.code(500).send(result);
  });

  // ============================================================================
  // GET /instances/:id/profile - Get own profile
  // ============================================================================
  server.get('/instances/:instanceId/profile', {
    schema: {
      params: {
        type: 'object',
        required: ['instanceId'],
        properties: {
          instanceId: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };

    const client = instanceManager.getClient(instanceId);
    if (!client) {
      return reply.code(404).send({
        success: false,
        error: 'Instance not found',
      });
    }

    const profile = await client.getOwnProfile();

    if (profile) {
      return reply.send(profile);
    }

    return reply.code(500).send({
      success: false,
      error: 'Failed to get profile',
    });
  });

  // ============================================================================
  // GET /instances/:id/labels - Get all labels
  // ============================================================================
  server.get('/instances/:instanceId/labels', {
    schema: {
      params: {
        type: 'object',
        required: ['instanceId'],
        properties: {
          instanceId: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };

    const client = instanceManager.getClient(instanceId);
    if (!client) {
      return reply.code(404).send({
        success: false,
        error: 'Instance not found',
      });
    }

    const result = await client.fetchAllLabels();

    if (result.success) {
      return reply.send(result);
    }

    return reply.code(500).send(result);
  });

  // ============================================================================
  // GET /instances/:id/chats - Get all chats
  // ============================================================================
  server.get('/instances/:instanceId/chats', {
    schema: {
      params: {
        type: 'object',
        required: ['instanceId'],
        properties: {
          instanceId: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };

    const client = instanceManager.getClient(instanceId);
    if (!client) {
      return reply.code(404).send({
        success: false,
        error: 'Instance not found',
      });
    }

    const result = await client.fetchAllChats();

    if (result.success) {
      return reply.send(result);
    }

    return reply.code(500).send(result);
  });

  // ============================================================================
  // GET /instances/:id/chats/:jid/messages - Get chat messages
  // ============================================================================
  server.get('/instances/:instanceId/chats/:jid/messages', {
    schema: {
      params: {
        type: 'object',
        required: ['instanceId', 'jid'],
        properties: {
          instanceId: { type: 'string', minLength: 1 },
          jid: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (request, reply) => {
    const { instanceId, jid } = request.params as { instanceId: string; jid: string };

    const client = instanceManager.getClient(instanceId);
    if (!client) {
      return reply.code(404).send({
        success: false,
        error: 'Instance not found',
      });
    }

    const result = await client.getChatMessages(jid);

    if (result.success) {
      return reply.send(result);
    }

    return reply.code(500).send(result);
  });
}
