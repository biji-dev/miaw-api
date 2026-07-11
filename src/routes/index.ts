/**
 * Routes Registry
 * Register all API routes
 */

import { FastifyInstance } from 'fastify';
import { InstanceManager } from '../services/InstanceManager.js';
import { instanceRoutes } from './instances.js';
import { connectionRoutes } from './connection.js';
import { messagingRoutes } from './messaging.js';
import { contactRoutes } from './contacts.js';
import { groupRoutes } from './groups.js';
import { profileRoutes } from './profile.js';
import { presenceRoutes } from './presence.js';
import { webhookRoutes } from './webhooks.js';
import { businessRoutes } from './business.js';
import { newsletterRoutes } from './newsletters.js';
import { basicGetsRoutes } from './basic-gets.js';
import { sessionRoutes } from './session.js';
import { advancedMessagingRoutes } from './advanced-messaging.js';
import { businessExtraRoutes } from './business-extras.js';
import { communityRoutes } from './communities.js';
import { operationRoutes } from './operations.js';

/**
 * Register all routes
 */
export async function registerRoutes(server: FastifyInstance, instanceManager: InstanceManager): Promise<void> {
  // Instance management routes
  await server.register(instanceRoutes);

  // Connection routes
  await server.register(connectionRoutes);

  // Messaging routes
  await server.register(messagingRoutes);

  // Contact routes
  await server.register(contactRoutes);

  // Group routes
  await server.register(groupRoutes);

  // Profile routes
  await server.register(profileRoutes);

  // Presence & UX routes
  await server.register(presenceRoutes);

  // Webhook management routes
  await server.register(webhookRoutes);

  // Business features routes
  await server.register(businessRoutes);

  // Newsletter routes (v0.13.0)
  await server.register(newsletterRoutes);

  // Basic GET operations routes (v0.9.0)
  await server.register(async (server) => {
    await basicGetsRoutes(server, instanceManager);
  });

  // Session lifecycle & stats routes (v0.15.0)
  await server.register(sessionRoutes);

  await server.register(advancedMessagingRoutes);
  await server.register(businessExtraRoutes);
  await server.register(communityRoutes);
  await server.register(operationRoutes);
}
