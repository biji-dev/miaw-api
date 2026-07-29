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
  await server.register(async (api) => {
    api.addHook('onRoute', (route) => {
      if (!route.url.startsWith('/instances')) return;
      route.schema = {
        ...route.schema,
        response: {
          ...(route.schema?.response ?? {}),
          '2xx': { $ref: 'successEnvelope#' },
        },
      };
    });

    await api.register(instanceRoutes);
    await api.register(connectionRoutes);
    await api.register(messagingRoutes);
    await api.register(contactRoutes);
    await api.register(groupRoutes);
    await api.register(profileRoutes);
    await api.register(presenceRoutes);
    await api.register(webhookRoutes);
    await api.register(businessRoutes);
    await api.register(newsletterRoutes);
    await api.register(async (scoped) => {
      await basicGetsRoutes(scoped, instanceManager);
    });
    await api.register(sessionRoutes);
    await api.register(advancedMessagingRoutes);
    await api.register(businessExtraRoutes);
    await api.register(communityRoutes);
    await api.register(operationRoutes);
  }, { prefix: '/api/v1' });
}
