/**
 * Miaw API Server
 * REST API wrapper for miaw-core
 */

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config';
import { registerRoutes } from './routes';
import { registerSchemas } from './schemas';
import { InstanceManager } from './services/InstanceManager';
import { WebhookDispatcher } from './services/WebhookDispatcher';
import { errorHandler } from './utils/errorHandler';

/**
 * Create and configure Fastify server
 */
export async function createServer(): Promise<FastifyInstance> {
  const server: FastifyInstance = Fastify({
    logger: {
      level: config.logLevel,
      transport:
        config.logLevel === 'debug'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'reqId,responseTime',
              },
            }
          : undefined,
    },
  });

  // Register plugins
  await server.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  await server.register(swagger, {
    openapi: {
      info: {
        title: 'Miaw API',
        description: 'REST API wrapper for miaw-core - Multiple Instance of App WhatsApp',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://localhost:${config.port}`,
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'Instances', description: 'Instance management' },
        { name: 'Messaging', description: 'Send messages' },
        { name: 'Contacts', description: 'Contact operations' },
        { name: 'Groups', description: 'Group management' },
        { name: 'Profile', description: 'Profile management' },
        { name: 'Presence', description: 'Presence & UX' },
        { name: 'Webhooks', description: 'Webhook configuration' },
        { name: 'Health', description: 'Health check' },
      ],
    },
  });

  await server.register(swaggerUi, {
    routePrefix: '/',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Register schemas
  registerSchemas(server);

  // Register error handler
  setErrorHandler(server);

  // Register health check
  server.get('/health', async (_request, _reply) => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // Create instance manager (shared across requests)
  const instanceManager = new InstanceManager({
    sessionPath: config.sessionPath,
    webhookSecret: config.webhookSecret,
    webhookTimeout: config.webhookTimeout,
    webhookMaxRetries: config.webhookMaxRetries,
    webhookRetryDelay: config.webhookRetryDelay,
  });

  // Create webhook dispatcher
  const webhookDispatcher = new WebhookDispatcher({
    secret: config.webhookSecret,
    timeout: config.webhookTimeout,
    maxRetries: config.webhookMaxRetries,
    retryDelay: config.webhookRetryDelay,
  });

  // Connect instance manager webhook events to dispatcher
  instanceManager.on('webhook', (url: string, payload: any) => {
    webhookDispatcher.queue(url, payload);
  });

  // Decorate server with instance manager
  server.decorate('instanceManager', instanceManager);
  server.decorate('webhookDispatcher', webhookDispatcher);

  // Register API routes (pass instanceManager for v0.9.0 routes)
  await registerRoutes(server, instanceManager);

  return server;
}

/**
 * Set global error handler
 */
function setErrorHandler(server: FastifyInstance): void {
  server.setErrorHandler((error: unknown, request, reply) => {
    errorHandler(error as Error, request, reply);

    // Don't reply if headers already sent
    if (reply.sent) {
      request.log.error('Error after headers sent: %s', error);
      return;
    }

    reply.send(error);
  });
}

/**
 * Start the server
 */
export async function startServer(): Promise<void> {
  const server = await createServer();

  try {
    await server.listen({ port: config.port, host: config.host });
    server.log.info(`Server listening on http://${config.host}:${config.port}`);
    server.log.info(`API documentation available at http://${config.host}:${config.port}/`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Start server if run directly
if (require.main === module) {
  startServer();
}
