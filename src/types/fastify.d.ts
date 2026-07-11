import type { InstanceManager } from '../services/InstanceManager.js';
import type { WebhookDispatcher } from '../services/WebhookDispatcher.js';

declare module 'fastify' {
  interface FastifyInstance {
    instanceManager: InstanceManager;
    webhookDispatcher: WebhookDispatcher;
  }
}

