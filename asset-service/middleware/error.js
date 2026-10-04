import { env } from '../config/env.js';

export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

export function errorBody({ code, message, details = [], requestId }) {
  return {
    error: {
      code,
      message,
      details,
      requestId,
    },
  };
}

export function sendError(res, { status, code, message, details = [], requestId }) {
  return res.status(status).json(errorBody({ code, message, details, requestId }));
}

function fromValidationError(err) {
  const details = Object.entries(err.errors ?? {}).map(([field, e]) => ({
    field,
    message: e.message,
  }));

  return new ApiError(400, 'VALIDATION_ERROR', 'Document failed model validation', details);
}

function fromCastError(err) {
  const isObjectId = err.kind === 'ObjectId';
  return new ApiError(
    400,
    isObjectId ? 'INVALID_ID' : 'INVALID_VALUE',
    isObjectId
      ? `"${err.value}" is not a valid id`
      : `"${err.value}" is not a valid value for ${err.path}`
  );
}

function fromDuplicateKey(err) {
  const fields = Object.keys(err.keyValue ?? {});
  const field = fields[0] ?? 'field';

  return new ApiError(409, 'DUPLICATE_KEY', `${field} already exists`, [
    { field, message: `A record with this ${field} already exists` },
  ]);
}

function fromBodyParserError(err) {
  if (err.type === 'entity.parse.failed') {
    return new ApiError(400, 'MALFORMED_JSON', 'Request body is not valid JSON');
  }

  if (err.type === 'entity.too.large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds the 1MB limit');
  }

  return null;
}

export function normalizeError(err) {
  if (err instanceof ApiError) {
    return err;
  }

  if (err?.name === 'ValidationError' && err.errors) {
    return fromValidationError(err);
  }

  if (err?.name === 'CastError') {
    return fromCastError(err);
  }

  if (err?.code === 11000 || err?.code === 11001) {
    return fromDuplicateKey(err);
  }

  const bodyParserError = fromBodyParserError(err);
  if (bodyParserError) {
    return bodyParserError;
  }

  const status = err?.status ?? err?.statusCode ?? 500;

  if (status >= 400 && status < 500) {
    return new ApiError(status, err.code ?? 'BAD_REQUEST', err.message);
  }

  return new ApiError(500, 'INTERNAL_ERROR', 'Internal server error');
}

export function notFound(req, res) {
  return sendError(res, {
    status: 404,
    code: 'ROUTE_NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    requestId: req.id,
  });
}

export function errorHandler(err, req, res, _next) {
  if (res.headersSent) {
    return _next(err);
  }

  const normalized = normalizeError(err);

  if (normalized.status >= 500) {
    console.error(`[error] ${req.id} ${req.method} ${req.originalUrl}`, err);
  }

  const message =
    normalized.status >= 500 && env.nodeEnv === 'production'
      ? 'Internal server error'
      : normalized.message;

  return sendError(res, {
    status: normalized.status,
    code: normalized.code,
    message,
    details: normalized.details,
    requestId: req.id,
  });
}