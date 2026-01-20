/**
 * Newsletter Management Routes
 * POST /instances/:id/newsletters - Create newsletter
 * DELETE /instances/:id/newsletters/:newsletterId - Delete newsletter
 * GET /instances/:id/newsletters/:newsletterId - Get newsletter metadata
 * GET /instances/:id/newsletters/:newsletterId/messages - Get newsletter messages
 * POST /instances/:id/newsletters/:newsletterId/messages/text - Send text message
 * POST /instances/:id/newsletters/:newsletterId/messages/image - Send image
 * POST /instances/:id/newsletters/:newsletterId/messages/video - Send video
 * POST /instances/:id/newsletters/:newsletterId/follow - Follow newsletter
 * DELETE /instances/:id/newsletters/:newsletterId/follow - Unfollow newsletter
 * POST /instances/:id/newsletters/:newsletterId/mute - Mute newsletter
 * DELETE /instances/:id/newsletters/:newsletterId/mute - Unmute newsletter
 * PATCH /instances/:id/newsletters/:newsletterId/name - Update name
 * PATCH /instances/:id/newsletters/:newsletterId/description - Update description
 * POST /instances/:id/newsletters/:newsletterId/picture - Update picture
 * DELETE /instances/:id/newsletters/:newsletterId/picture - Remove picture
 * POST /instances/:id/newsletters/:newsletterId/messages/:messageId/reaction - React to message
 * POST /instances/:id/newsletters/:newsletterId/subscribe - Subscribe to updates
 * GET /instances/:id/newsletters/:newsletterId/subscribers - Get subscriber info
 * GET /instances/:id/newsletters/:newsletterId/admins/count - Get admin count
 * POST /instances/:id/newsletters/:newsletterId/owner - Transfer ownership
 * DELETE /instances/:id/newsletters/:newsletterId/admins/:adminJid - Demote admin
 */

import { FastifyInstance } from 'fastify';
import { createAuthMiddleware } from '../middleware/auth';

/**
 * Register newsletter management routes
 */
export async function newsletterRoutes(server: FastifyInstance): Promise<void> {
  // All routes require authentication
  server.addHook('onRequest', createAuthMiddleware());

  // Newsletter routes will be implemented in subsequent commits
}
