/**
 * Authentication Middleware
 * Validates API key for protected endpoints
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config';
import { UnauthorizedError } from '../utils/errorHandler';

/**
 * Extract API key from request
 */
function extractApiKey(request: FastifyRequest): string | null {
  // Try Authorization header first
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try X-API-Key header
  const apiKey = request.headers['x-api-key'] as string;
  if (apiKey) {
    return apiKey;
  }

  return null;
}

/**
 * Authentication middleware factory
 */
export function createAuthMiddleware() {
  return async function authMiddleware(
    request: FastifyRequest,
    _reply: FastifyReply
  ): Promise<void> {
    const apiKey = extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedError('Missing API key');
    }

    if (apiKey !== config.apiKey) {
      throw new UnauthorizedError('Invalid API key');
    }

    // API key is valid, continue
  };
}
