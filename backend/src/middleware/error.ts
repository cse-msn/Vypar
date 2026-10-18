import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export const notFound: RequestHandler = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

/** Central error handler — normalises every error into a consistent JSON envelope. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let code: string | undefined;
  let details: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code;
    details = err.details;
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, v.message]),
    );
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid value for "${err.path}"`;
  } else if ((err as { code?: number }).code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY';
    const key = Object.keys((err as { keyValue?: Record<string, unknown> }).keyValue ?? {})[0];
    message = key ? `A record with that ${key} already exists` : 'Duplicate value';
  } else if (err instanceof jwt.TokenExpiredError) {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Session expired, please sign in again';
  } else if (err instanceof jwt.JsonWebTokenError) {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (err instanceof Error) {
    message = err.message || message;
  }

  if (statusCode >= 500) {
    logger.error('Unhandled error', err);
  }

  res.status(statusCode).json({
    error: {
      message,
      code,
      ...(details ? { details } : {}),
      ...(env.isProd || statusCode < 500
        ? {}
        : { stack: err instanceof Error ? err.stack : undefined }),
    },
  });
};
