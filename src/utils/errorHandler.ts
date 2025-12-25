/**
 * Error handling utilities
 */

import { FastifyReply } from 'fastify';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, details?: any) {
    super(400, 'INVALID_REQUEST', message, details);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message: string) {
    super(503, 'SERVICE_UNAVAILABLE', message);
  }
}

/**
 * Global error handler
 */
export function errorHandler(
  error: Error,
  request: any,
  reply: FastifyReply
): void {
  request.log.error(error);

  if (error instanceof ApiError) {
    reply.status(error.statusCode).send({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  // Handle unknown errors
  reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
