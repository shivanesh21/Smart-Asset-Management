import { env } from '../config/env.js';

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFound(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      details: [],
      requestId: req.id,
    },
  });
}

export function errorHandler(err, req, res, _next) {
  if (res.headersSent) {
    return;
  }

  const status = err.status ?? err.statusCode ?? 500;
  const code = err.code ?? (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED');

  if (status >= 500) {
    console.error(`[error] ${req.id} ${req.method} ${req.originalUrl}`, err);
  }

  res.status(status).json({
    error: {
      code,
      message: status === 500 && env.nodeEnv === 'production' ? 'Internal server error' : err.message,
      details: err.details ?? [],
      requestId: req.id,
    },
  });
}
