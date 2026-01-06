import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { errorResponse } from '../utils/response.js';
import { HTTP_STATUS } from '../config/constants.js';
import logger from '../utils/logger.js';

/**
 * Global error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  logger.error('Error occurred:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return errorResponse(
      res,
      'Validation failed',
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      errors
    );
  }

  // Handle Prisma errors
  if (err.code) {
    switch (err.code) {
      case 'P2002':
        return errorResponse(
          res,
          'A record with this value already exists',
          HTTP_STATUS.CONFLICT
        );
      case 'P2025':
        return errorResponse(
          res,
          'Record not found',
          HTTP_STATUS.NOT_FOUND
        );
      case 'P2003':
        return errorResponse(
          res,
          'Foreign key constraint failed',
          HTTP_STATUS.BAD_REQUEST
        );
      default:
        logger.error('Prisma error:', { code: err.code, meta: err.meta });
    }
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    return errorResponse(res, err.message, err.statusCode);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'Invalid token', HTTP_STATUS.UNAUTHORIZED);
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'Token expired', HTTP_STATUS.UNAUTHORIZED);
  }

  // Default error
  return errorResponse(
    res,
    process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    HTTP_STATUS.INTERNAL_SERVER_ERROR
  );
};

/**
 * Handle 404 errors
 */
export const notFoundHandler = (req, res) => {
  return errorResponse(
    res,
    `Route ${req.originalUrl} not found`,
    HTTP_STATUS.NOT_FOUND
  );
};
