/**
 * Routes Registry
 * Register all API routes
 */

import { FastifyInstance } from 'fastify';
import { instanceRoutes } from './instances';
import { connectionRoutes } from './connection';
import { messagingRoutes } from './messaging';

/**
 * Register all routes
 */
export async function registerRoutes(server: FastifyInstance): Promise<void> {
  // Instance management routes
  await server.register(instanceRoutes);

  // Connection routes
  await server.register(connectionRoutes);

  // Messaging routes
  await server.register(messagingRoutes);
}
