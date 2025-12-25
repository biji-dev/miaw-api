/**
 * Routes Registry
 * Register all API routes
 */

import { FastifyInstance } from 'fastify';
import { instanceRoutes } from './instances';
import { connectionRoutes } from './connection';
import { messagingRoutes } from './messaging';
import { contactRoutes } from './contacts';

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

  // Contact routes
  await server.register(contactRoutes);
}
