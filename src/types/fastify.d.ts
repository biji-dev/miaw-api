import type { InstanceManager } from '../services/InstanceManager.js';
import type { ProxyPoolService } from '../services/ProxyService.js';
import type { WebhookDispatcher } from '../services/WebhookDispatcher.js';

declare module 'fastify' {
  interface FastifyInstance {
    instanceManager: InstanceManager;
    proxyPool: ProxyPoolService;
    webhookDispatcher: WebhookDispatcher;
  }
}
