/**
 * JSON Schema definitions for request validation
 */

import { FastifyInstance } from 'fastify';

/**
 * Register all schemas
 */
export function registerSchemas(server: FastifyInstance): void {
  // Instance ID pattern
  const instanceIdPattern = '^[a-z0-9_-]+$';

  // ============================================================================
  // Instance Schemas
  // ============================================================================

  server.addSchema({
    $id: 'createInstance',
    type: 'object',
    required: ['instanceId'],
    properties: {
      instanceId: {
        type: 'string',
        pattern: instanceIdPattern,
        minLength: 1,
        maxLength: 50,
      },
      webhookUrl: {
        type: 'string',
        format: 'uri',
        nullable: true,
      },
      webhookEvents: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['qr', 'ready', 'message', 'message_edit', 'message_delete', 'message_reaction', 'presence', 'connection', 'disconnected', 'reconnecting', 'error'],
        },
        nullable: true,
      },
    },
  });

  // ============================================================================
  // Messaging Schemas
  // ============================================================================

  server.addSchema({
    $id: 'sendText',
    type: 'object',
    required: ['to', 'text'],
    properties: {
      to: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
      },
      text: {
        type: 'string',
        minLength: 1,
      },
      quoted: {
        type: 'string',
        nullable: true,
      },
    },
  });

  server.addSchema({
    $id: 'sendMedia',
    type: 'object',
    required: ['to', 'media'],
    properties: {
      to: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
      },
      media: {
        type: 'string',
        format: 'uri',
      },
      caption: {
        type: 'string',
        nullable: true,
      },
      fileName: {
        type: 'string',
        nullable: true,
      },
      mimetype: {
        type: 'string',
        nullable: true,
      },
      viewOnce: {
        type: 'boolean',
        nullable: true,
      },
      ptt: {
        type: 'boolean',
        nullable: true,
      },
      gifPlayback: {
        type: 'boolean',
        nullable: true,
      },
      quoted: {
        type: 'string',
        nullable: true,
      },
    },
  });

  server.addSchema({
    $id: 'editMessage',
    type: 'object',
    required: ['messageId', 'text'],
    properties: {
      messageId: {
        type: 'string',
      },
      text: {
        type: 'string',
        minLength: 1,
      },
    },
  });

  server.addSchema({
    $id: 'reactionMessage',
    type: 'object',
    required: ['messageId', 'emoji'],
    properties: {
      messageId: {
        type: 'string',
      },
      emoji: {
        type: 'string',
      },
    },
  });

  server.addSchema({
    $id: 'forwardMessage',
    type: 'object',
    required: ['messageId', 'to'],
    properties: {
      messageId: {
        type: 'string',
      },
      to: {
        type: 'array',
        items: {
          type: 'string',
        },
        minItems: 1,
        maxItems: 50,
      },
    },
  });

  server.addSchema({
    $id: 'sendImage',
    type: 'object',
    required: ['to', 'image'],
    properties: {
      to: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
      },
      image: {
        type: 'string',
        format: 'uri',
      },
      caption: {
        type: 'string',
        nullable: true,
      },
      viewOnce: {
        type: 'boolean',
        nullable: true,
      },
      quoted: {
        type: 'string',
        nullable: true,
      },
    },
  });

  server.addSchema({
    $id: 'sendVideo',
    type: 'object',
    required: ['to', 'video'],
    properties: {
      to: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
      },
      video: {
        type: 'string',
        format: 'uri',
      },
      caption: {
        type: 'string',
        nullable: true,
      },
      viewOnce: {
        type: 'boolean',
        nullable: true,
      },
      gifPlayback: {
        type: 'boolean',
        nullable: true,
      },
      ptv: {
        type: 'boolean',
        nullable: true,
        description: 'Send as video note (circular video)',
      },
      quoted: {
        type: 'string',
        nullable: true,
      },
    },
  });

  server.addSchema({
    $id: 'sendAudio',
    type: 'object',
    required: ['to', 'audio'],
    properties: {
      to: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
      },
      audio: {
        type: 'string',
        format: 'uri',
      },
      ptt: {
        type: 'boolean',
        nullable: true,
        description: 'Send as voice note (push-to-talk)',
      },
      mimetype: {
        type: 'string',
        nullable: true,
      },
      quoted: {
        type: 'string',
        nullable: true,
      },
    },
  });

  server.addSchema({
    $id: 'sendDocument',
    type: 'object',
    required: ['to', 'document'],
    properties: {
      to: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
      },
      document: {
        type: 'string',
        format: 'uri',
      },
      caption: {
        type: 'string',
        nullable: true,
      },
      fileName: {
        type: 'string',
        nullable: true,
      },
      mimetype: {
        type: 'string',
        nullable: true,
      },
      quoted: {
        type: 'string',
        nullable: true,
      },
    },
  });

  // ============================================================================
  // Contact Schemas
  // ============================================================================

  server.addSchema({
    $id: 'checkNumber',
    type: 'object',
    required: ['phone'],
    properties: {
      phone: {
        type: 'string',
        pattern: '^[0-9]+$',
        minLength: 10,
        maxLength: 15,
      },
    },
  });

  server.addSchema({
    $id: 'checkBatch',
    type: 'object',
    required: ['phones'],
    properties: {
      phones: {
        type: 'array',
        items: {
          type: 'string',
          pattern: '^[0-9]+$',
        },
        minItems: 1,
        maxItems: 50,
      },
    },
  });

  server.addSchema({
    $id: 'addContact',
    type: 'object',
    required: ['phone', 'name'],
    properties: {
      phone: {
        type: 'string',
        pattern: '^[0-9]+$',
        minLength: 10,
        maxLength: 15,
      },
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
      },
      firstName: {
        type: 'string',
        nullable: true,
      },
      lastName: {
        type: 'string',
        nullable: true,
      },
    },
  });

  // ============================================================================
  // Group Schemas
  // ============================================================================

  server.addSchema({
    $id: 'createGroup',
    type: 'object',
    required: ['name', 'participants'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 25,
      },
      participants: {
        type: 'array',
        items: {
          type: 'string',
        },
        minItems: 1,
        maxItems: 1023,
      },
    },
  });

  server.addSchema({
    $id: 'groupParticipants',
    type: 'object',
    required: ['participants'],
    properties: {
      participants: {
        type: 'array',
        items: {
          type: 'string',
        },
        minItems: 1,
        maxItems: 50,
      },
    },
  });

  server.addSchema({
    $id: 'updateGroup',
    type: 'object',
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 25,
        nullable: true,
      },
      description: {
        type: 'string',
        nullable: true,
      },
    },
  });

  // ============================================================================
  // Profile Schemas
  // ============================================================================

  server.addSchema({
    $id: 'updateProfilePicture',
    type: 'object',
    required: ['url'],
    properties: {
      url: {
        type: 'string',
        format: 'uri',
      },
    },
  });

  server.addSchema({
    $id: 'updateProfileName',
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 25,
      },
    },
  });

  server.addSchema({
    $id: 'updateProfileStatus',
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        maxLength: 139,
      },
    },
  });

  // ============================================================================
  // Presence Schemas
  // ============================================================================

  server.addSchema({
    $id: 'setPresence',
    type: 'object',
    required: ['status'],
    properties: {
      status: {
        type: 'string',
        enum: ['available', 'unavailable'],
      },
    },
  });

  // ============================================================================
  // Newsletter Schemas (Phase 12)
  // ============================================================================

  server.addSchema({
    $id: 'createNewsletter',
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'Newsletter name',
      },
      description: {
        type: 'string',
        maxLength: 2048,
        nullable: true,
        description: 'Newsletter description',
      },
    },
  });

  server.addSchema({
    $id: 'sendNewsletterText',
    type: 'object',
    required: ['text'],
    properties: {
      text: {
        type: 'string',
        minLength: 1,
        description: 'Text message to send to the newsletter',
      },
    },
  });

  server.addSchema({
    $id: 'sendNewsletterImage',
    type: 'object',
    required: ['image'],
    properties: {
      image: {
        type: 'string',
        description: 'Image URL or base64 data',
      },
      caption: {
        type: 'string',
        nullable: true,
        description: 'Image caption',
      },
    },
  });

  server.addSchema({
    $id: 'sendNewsletterVideo',
    type: 'object',
    required: ['video'],
    properties: {
      video: {
        type: 'string',
        description: 'Video URL or base64 data',
      },
      caption: {
        type: 'string',
        nullable: true,
        description: 'Video caption',
      },
    },
  });

  server.addSchema({
    $id: 'updateNewsletterName',
    type: 'object',
    required: ['name'],
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        description: 'New newsletter name',
      },
    },
  });

  server.addSchema({
    $id: 'updateNewsletterDescription',
    type: 'object',
    required: ['description'],
    properties: {
      description: {
        type: 'string',
        maxLength: 2048,
        description: 'New newsletter description',
      },
    },
  });

  server.addSchema({
    $id: 'updateNewsletterPicture',
    type: 'object',
    required: ['image'],
    properties: {
      image: {
        type: 'string',
        description: 'Image URL or base64 data for newsletter picture',
      },
    },
  });

  server.addSchema({
    $id: 'reactToNewsletterMessage',
    type: 'object',
    required: ['emoji'],
    properties: {
      emoji: {
        type: 'string',
        description: 'Emoji to react with (empty string removes reaction)',
      },
    },
  });

  server.addSchema({
    $id: 'changeNewsletterOwner',
    type: 'object',
    required: ['newOwnerJid'],
    properties: {
      newOwnerJid: {
        type: 'string',
        description: 'JID of the new owner',
      },
    },
  });
}
