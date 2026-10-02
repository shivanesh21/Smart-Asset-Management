import { validationResult } from 'express-validator';

export function handleValidation(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  const details = result.array().map((e) => ({
    field: e.path ?? e.param,
    message: e.msg,
  }));

  return res.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request failed validation',
      details,
      requestId: req.id,
    },
  });
}
