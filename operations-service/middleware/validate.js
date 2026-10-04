import { validationResult } from 'express-validator';
import { sendError } from './error.js';

export function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  const details = result.array().map((e) => ({
    field: e.path ?? e.param,
    message: e.msg,
  }));

  return sendError(res, {
    status: 400,
    code: 'VALIDATION_ERROR',
    message: 'Request failed validation',
    details,
    requestId: req.id,
  });
}