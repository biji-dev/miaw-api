/**
 * Messaging Routes
 * POST /instances/:instanceId/messages/text - Send text message
 * POST /instances/:instanceId/messages/:type - Send typed media
 * PATCH /instances/:instanceId/messages/:messageId - Edit message
 * DELETE /instances/:instanceId/messages/:messageId - Delete message
 * PUT /instances/:instanceId/messages/:messageId/reaction - React to message
 * DELETE /instances/:instanceId/messages/:messageId/reaction - Remove reaction from message
 * POST /instances/:instanceId/messages/:messageId/forward - Forward message
 * GET /instances/:instanceId/messages/:messageId/media - Download media from message
 * POST /instances/:instanceId/chats/:chatJid/message-history-loads - Load chat history
 */

import { FastifyInstance } from 'fastify';
import type { SendMessageResult } from 'miaw-core';
import { createAuthMiddleware } from '../middleware/auth.js';
import { NotFoundError, BadRequestError, ServiceUnavailableError } from '../utils/errorHandler.js';
import { requireCoreSuccess, requireMessage, resolveQuote } from '../utils/client.js';

function messageResponse(result: SendMessageResult, to: string) {
  if (!result.success) {
    throw new BadRequestError('miaw-core rejected the message', { error: result.error });
  }
  return { messageId: result.messageId, to, timestamp: Date.now() };
}

/**
 * Register messaging routes
 */
export async function messagingRoutes(server: FastifyInstance): Promise<void> {
  // All routes require authentication
  server.addHook('onRequest', createAuthMiddleware());

  /**
   * POST /instances/:instanceId/messages/text
   * Send text message
   */
  server.post(
    '/instances/:instanceId/messages/text',
    {
      schema: {
        description: 'Send a text message',
        tags: ['Messaging'],
        summary: 'Send text message',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
          },
          required: ['instanceId'],
        },
        body: {
          $ref: 'sendText#',
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string };
      const body = request.body as {
        to: string;
        text: string;
        quoted?: string;
        quotedChatJid?: string;
        mentions?: string[];
      };

      const instanceManager = server.instanceManager;
      const client = instanceManager.getClient(params.instanceId);
      const instance = instanceManager.getInstance(params.instanceId);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      try {
        const quoted = await resolveQuote(client, body.quoted, body.quotedChatJid);
        const result = await client.sendText(body.to, body.text, {
          quoted,
          mentions: body.mentions,
        });

        reply.send({
          success: true,
          data: {
            ...messageResponse(result, body.to),
          },
        });
      } catch (err: any) {
        if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
        throw new BadRequestError('Failed to send message', { error: err.message });
      }
    }
  );


  /**
   * PATCH /instances/:instanceId/messages/:messageId
   * Edit a text message
   */
  server.patch(
    '/instances/:instanceId/messages/:messageId',
    {
      onRequest: async (request) => {
        // `/messages/edit` was a 1.x body-identified command. Keep that exact
        // removed path from being interpreted as the v2 message ID "edit".
        if ((request.params as { messageId?: string }).messageId === 'edit') {
          throw new NotFoundError('Route');
        }
      },
      schema: {
        description: 'Edit a previously sent text message',
        tags: ['Messaging'],
        summary: 'Edit message',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
            messageId: { type: 'string' },
          },
          required: ['instanceId', 'messageId'],
        },
        body: {
          $ref: 'editMessage#',
        },
        querystring: {
          type: 'object',
          properties: { chatJid: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string; messageId: string };
      const body = request.body as {
        text: string;
      };
      const query = request.query as { chatJid?: string };

      const instanceManager = server.instanceManager;
      const client = instanceManager.getClient(params.instanceId);
      const instance = instanceManager.getInstance(params.instanceId);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      try {
        const message = await requireMessage(client, params.messageId, query.chatJid);
        if (!message) throw new NotFoundError('Message');
        const result = requireCoreSuccess(
          await client.editMessage(message, body.text),
          'Edit message'
        );

        reply.send({
          success: true,
          data: {
            messageId: result.messageId || params.messageId,
            timestamp: Date.now(),
          },
        });
      } catch (err: any) {
        if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
        throw new BadRequestError('Failed to edit message', { error: err.message });
      }
    }
  );

  /**
   * DELETE /instances/:instanceId/messages/:messageId
   * Delete a message
   */
  server.delete(
    '/instances/:instanceId/messages/:messageId',
    {
      schema: {
        description: 'Delete a message (for everyone or for me)',
        tags: ['Messaging'],
        summary: 'Delete message',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
            messageId: { type: 'string' },
          },
          required: ['instanceId', 'messageId'],
        },
        querystring: {
          type: 'object',
          properties: {
            scope: { type: 'string', enum: ['everyone', 'local'], default: 'everyone' },
            chatJid: { type: 'string' },
            deleteMedia: { type: 'boolean', default: true },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string; messageId: string };
      const query = request.query as {
        scope?: 'everyone' | 'local';
        chatJid?: string;
        deleteMedia?: boolean;
      };

      const instanceManager = server.instanceManager;
      const client = instanceManager.getClient(params.instanceId);
      const instance = instanceManager.getInstance(params.instanceId);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      try {
        const message = await requireMessage(client, params.messageId, query.chatJid);
        if (!message) throw new NotFoundError('Message');
        if (query.scope === 'local') {
          requireCoreSuccess(
            await client.deleteMessageForMe(message, query.deleteMedia !== false),
            'Delete message locally'
          );
        } else {
          requireCoreSuccess(await client.deleteMessage(message), 'Delete message');
        }

        reply.send({
          success: true,
          data: { deleted: true, scope: query.scope ?? 'everyone' },
        });
      } catch (err: any) {
        if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
        throw new BadRequestError('Failed to delete message', { error: err.message });
      }
    }
  );

  /**
   * PUT /instances/:instanceId/messages/:messageId/reaction
   * React to a message with emoji
   */
  server.put(
    '/instances/:instanceId/messages/:messageId/reaction',
    {
      schema: {
        description: 'React to a message with an emoji (send empty emoji to remove)',
        tags: ['Messaging'],
        summary: 'React to message',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
            messageId: { type: 'string' },
          },
          required: ['instanceId', 'messageId'],
        },
        body: {
          $ref: 'reactionMessage#',
        },
        querystring: {
          type: 'object',
          properties: { chatJid: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string; messageId: string };
      const body = request.body as {
        emoji: string;
      };
      const query = request.query as { chatJid?: string };

      const instanceManager = server.instanceManager;
      const client = instanceManager.getClient(params.instanceId);
      const instance = instanceManager.getInstance(params.instanceId);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      try {
        const message = await requireMessage(client, params.messageId, query.chatJid);
        if (!message) throw new NotFoundError('Message');
        if (body.emoji) {
          requireCoreSuccess(await client.sendReaction(message, body.emoji), 'Add reaction');
        } else {
          requireCoreSuccess(await client.removeReaction(message), 'Remove reaction');
        }

        reply.send({
          success: true,
          data: {
            messageId: params.messageId,
            emoji: body.emoji || '(removed)',
          },
        });
      } catch (err: any) {
        if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
        throw new BadRequestError('Failed to react to message', { error: err.message });
      }
    }
  );

  /**
   * DELETE /instances/:instanceId/messages/:messageId/reaction
   * Remove reaction from a message
   */
  server.delete(
    '/instances/:instanceId/messages/:messageId/reaction',
    {
      schema: {
        description: 'Remove reaction from a message',
        tags: ['Messaging'],
        summary: 'Remove reaction',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
            messageId: { type: 'string' },
          },
          required: ['instanceId', 'messageId'],
        },
        querystring: {
          type: 'object',
          properties: {
            chatJid: {
              type: 'string',
              description: 'Optional chat JID to speed up message lookup',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string; messageId: string };
      const query = request.query as { chatJid?: string };

      const instanceManager = server.instanceManager;
      const client = instanceManager.getClient(params.instanceId);
      const instance = instanceManager.getInstance(params.instanceId);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      try {
        // Find the message in the store
        const message = await requireMessage(client, params.messageId, query.chatJid);

        if (!message) {
          throw new NotFoundError('Message');
        }

        const result = await client.removeReaction(message);

        if (!result.success) {
          throw new BadRequestError('Failed to remove reaction', { error: result.error });
        }

        reply.send({
          success: true,
          data: { messageId: params.messageId, removed: true },
        });
      } catch (err: any) {
        if (err.code === 'NOT_FOUND' || err.code === 'BAD_REQUEST') {
          throw err;
        }
        throw new BadRequestError('Failed to remove reaction', { error: err.message });
      }
    }
  );


  /**
   * POST /instances/:instanceId/messages/:messageId/forward
   * Forward a message to one or more recipients
   */
  server.post(
    '/instances/:instanceId/messages/:messageId/forward',
    {
      schema: {
        description: 'Forward a message to one or more recipients',
        tags: ['Messaging'],
        summary: 'Forward message',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
            messageId: { type: 'string' },
          },
          required: ['instanceId', 'messageId'],
        },
        body: {
          $ref: 'forwardMessage#',
        },
        querystring: {
          type: 'object',
          properties: { chatJid: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string; messageId: string };
      const body = request.body as {
        to: string[];
      };
      const query = request.query as { chatJid?: string };

      const instanceManager = server.instanceManager;
      const client = instanceManager.getClient(params.instanceId);
      const instance = instanceManager.getInstance(params.instanceId);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      try {
        const message = await requireMessage(client, params.messageId, query.chatJid);
        if (!message) throw new NotFoundError('Message');
        const results = await Promise.all(
          body.to.map(async (to) => ({
            to,
            result: requireCoreSuccess(await client.forwardMessage(message, to), 'Forward message'),
          }))
        );

        reply.send({
          success: true,
          data: {
            forwarded: results.map(({ to, result }) => ({
              to,
              messageId: result.messageId,
            })),
          },
        });
      } catch (err: any) {
        if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
        throw new BadRequestError('Failed to forward message', { error: err.message });
      }
    }
  );

  /**
   * GET /instances/:instanceId/messages/:messageId/media
   * Download media from a message
   */
  server.get(
    '/instances/:instanceId/messages/:messageId/media',
    {
      schema: {
        description: 'Download media from a message (image, video, audio, document, sticker)',
        tags: ['Messaging'],
        summary: 'Download media',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
            messageId: { type: 'string' },
          },
          required: ['instanceId', 'messageId'],
        },
        querystring: {
          type: 'object',
          properties: {
            chatJid: {
              type: 'string',
              description: 'Optional chat JID to speed up message lookup',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string; messageId: string };
      const query = request.query as { chatJid?: string };

      const instanceManager = server.instanceManager;
      const client = instanceManager.getClient(params.instanceId);
      const instance = instanceManager.getInstance(params.instanceId);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      try {
        // Find the message in the store using helper
        const message = await requireMessage(client, params.messageId, query.chatJid);

        if (!message) {
          throw new NotFoundError('Message');
        }

        // Check if it's a media message
        const mediaTypes = ['image', 'video', 'audio', 'document', 'sticker'];
        if (!mediaTypes.includes(message.type)) {
          throw new BadRequestError('Message is not a media message', {
            type: message.type,
            supportedTypes: mediaTypes,
          });
        }

        // Download the media
        const buffer = await client.downloadMedia(message);

        if (!buffer) {
          throw new BadRequestError('Failed to download media', {
            error: 'Media download returned null - media may be expired or unavailable',
          });
        }

        // Determine content type
        const mimetypeMap: Record<string, string> = {
          image: 'image/jpeg',
          video: 'video/mp4',
          audio: 'audio/ogg',
          document: 'application/octet-stream',
          sticker: 'image/webp',
        };
        const contentType = message.media?.mimetype || mimetypeMap[message.type] || 'application/octet-stream';

        return reply.send({
          success: true,
          data: {
            contentBase64: buffer.toString('base64'),
            contentType,
            fileName: message.media?.fileName ?? null,
            size: buffer.length,
          },
        });
      } catch (err: any) {
        if (err.code === 'NOT_FOUND' || err.code === 'BAD_REQUEST') {
          throw err;
        }
        throw new BadRequestError('Failed to download media', { error: err.message });
      }
    }
  );

  /**
   * POST /instances/:instanceId/chats/:chatJid/message-history-loads
   * Load more messages from chat history
   */
  server.post(
    '/instances/:instanceId/chats/:chatJid/message-history-loads',
    {
      schema: {
        description: 'Load more messages from chat history (pagination). Fetches older messages beyond what is currently in memory.',
        tags: ['Messaging'],
        summary: 'Load more messages',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
            chatJid: { type: 'string', description: 'Chat JID (phone@s.whatsapp.net or groupId@g.us)' },
          },
          required: ['instanceId', 'chatJid'],
        },
        body: {
          type: 'object',
          properties: {
            count: {
              type: 'integer',
              minimum: 1,
              maximum: 50,
              default: 50,
              description: 'Number of messages to load (1-50, default: 50)',
            },
            timeoutMs: {
              type: 'integer',
              minimum: 5000,
              maximum: 60000,
              default: 30000,
              description: 'Timeout in milliseconds (5000-60000, default: 30000)',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string; chatJid: string };
      const body = (request.body ?? {}) as { count?: number; timeoutMs?: number };

      const instanceManager = server.instanceManager;
      const client = instanceManager.getClient(params.instanceId);
      const instance = instanceManager.getInstance(params.instanceId);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      const count = body.count || 50;
      const timeout = body.timeoutMs || 30000;

      try {
        const result = await client.loadMoreMessages(params.chatJid, count, timeout);

        reply.send({
          success: true,
          data: {
            messagesLoaded: result.messagesLoaded,
            hasMore: result.hasMore,
          },
        });
      } catch (err: any) {
        if (err instanceof NotFoundError || err instanceof BadRequestError) throw err;
        throw new BadRequestError('Failed to load more messages', { error: err.message });
      }
    }
  );

  /**
   * POST /instances/:instanceId/messages/image
   * Send an image message
   */
  server.post(
    '/instances/:instanceId/messages/image',
    {
      schema: {
        description: 'Send an image message',
        tags: ['Messaging'],
        summary: 'Send image',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
          },
          required: ['instanceId'],
        },
        body: {
          $ref: 'sendImage#',
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string };
      const body = request.body as {
        to: string;
        image: string;
        caption?: string;
        viewOnce?: boolean;
        quoted?: string;
        quotedChatJid?: string;
        mentions?: string[];
      };

      const instanceManager = server.instanceManager;
      const client = instanceManager.getClient(params.instanceId);
      const instance = instanceManager.getInstance(params.instanceId);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      try {
        const quoted = await resolveQuote(client, body.quoted, body.quotedChatJid);
        const result = await client.sendImage(body.to, body.image, {
          caption: body.caption,
          viewOnce: body.viewOnce,
          quoted,
          mentions: body.mentions,
        });

        if (!result.success) {
          throw new BadRequestError('Failed to send image', { error: result.error });
        }

        reply.send({
          success: true,
          data: {
            ...messageResponse(result, body.to),
          },
        });
      } catch (err: any) {
        if (err.code === 'BAD_REQUEST') {
          throw err;
        }
        throw new BadRequestError('Failed to send image', { error: err.message });
      }
    }
  );

  /**
   * POST /instances/:instanceId/messages/video
   * Send a video message
   */
  server.post(
    '/instances/:instanceId/messages/video',
    {
      schema: {
        description: 'Send a video message',
        tags: ['Messaging'],
        summary: 'Send video',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
          },
          required: ['instanceId'],
        },
        body: {
          $ref: 'sendVideo#',
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string };
      const body = request.body as {
        to: string;
        video: string;
        caption?: string;
        viewOnce?: boolean;
        gifPlayback?: boolean;
        ptv?: boolean;
        quoted?: string;
        quotedChatJid?: string;
        mentions?: string[];
      };

      const instanceManager = server.instanceManager;
      const client = instanceManager.getClient(params.instanceId);
      const instance = instanceManager.getInstance(params.instanceId);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      try {
        const quoted = await resolveQuote(client, body.quoted, body.quotedChatJid);
        const result = await client.sendVideo(body.to, body.video, {
          caption: body.caption,
          viewOnce: body.viewOnce,
          gifPlayback: body.gifPlayback,
          ptv: body.ptv,
          quoted,
          mentions: body.mentions,
        });

        if (!result.success) {
          throw new BadRequestError('Failed to send video', { error: result.error });
        }

        reply.send({
          success: true,
          data: {
            ...messageResponse(result, body.to),
          },
        });
      } catch (err: any) {
        if (err.code === 'BAD_REQUEST') {
          throw err;
        }
        throw new BadRequestError('Failed to send video', { error: err.message });
      }
    }
  );

  /**
   * POST /instances/:instanceId/messages/audio
   * Send an audio message
   */
  server.post(
    '/instances/:instanceId/messages/audio',
    {
      schema: {
        description: 'Send an audio message',
        tags: ['Messaging'],
        summary: 'Send audio',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
          },
          required: ['instanceId'],
        },
        body: {
          $ref: 'sendAudio#',
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string };
      const body = request.body as {
        to: string;
        audio: string;
        ptt?: boolean;
        mimetype?: string;
        quoted?: string;
        quotedChatJid?: string;
      };

      const instanceManager = server.instanceManager;
      const client = instanceManager.getClient(params.instanceId);
      const instance = instanceManager.getInstance(params.instanceId);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      try {
        const quoted = await resolveQuote(client, body.quoted, body.quotedChatJid);
        const result = await client.sendAudio(body.to, body.audio, {
          ptt: body.ptt,
          mimetype: body.mimetype,
          quoted,
        });

        if (!result.success) {
          throw new BadRequestError('Failed to send audio', { error: result.error });
        }

        reply.send({
          success: true,
          data: {
            ...messageResponse(result, body.to),
          },
        });
      } catch (err: any) {
        if (err.code === 'BAD_REQUEST') {
          throw err;
        }
        throw new BadRequestError('Failed to send audio', { error: err.message });
      }
    }
  );

  /**
   * POST /instances/:instanceId/messages/document
   * Send a document message
   */
  server.post(
    '/instances/:instanceId/messages/document',
    {
      schema: {
        description: 'Send a document message',
        tags: ['Messaging'],
        summary: 'Send document',
        params: {
          type: 'object',
          properties: {
            instanceId: { type: 'string' },
          },
          required: ['instanceId'],
        },
        body: {
          $ref: 'sendDocument#',
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { instanceId: string };
      const body = request.body as {
        to: string;
        document: string;
        caption?: string;
        fileName?: string;
        mimetype?: string;
        quoted?: string;
        quotedChatJid?: string;
      };

      const instanceManager = server.instanceManager;
      const client = instanceManager.getClient(params.instanceId);
      const instance = instanceManager.getInstance(params.instanceId);

      if (!client || !instance) {
        throw new NotFoundError('Instance');
      }

      if (instance.status !== 'connected') {
        throw new ServiceUnavailableError('Instance is not connected');
      }

      try {
        const quoted = await resolveQuote(client, body.quoted, body.quotedChatJid);
        const result = await client.sendDocument(body.to, body.document, {
          caption: body.caption,
          fileName: body.fileName,
          mimetype: body.mimetype,
          quoted,
        });

        if (!result.success) {
          throw new BadRequestError('Failed to send document', { error: result.error });
        }

        reply.send({
          success: true,
          data: {
            ...messageResponse(result, body.to),
          },
        });
      } catch (err: any) {
        if (err.code === 'BAD_REQUEST') {
          throw err;
        }
        throw new BadRequestError('Failed to send document', { error: err.message });
      }
    }
  );
}
