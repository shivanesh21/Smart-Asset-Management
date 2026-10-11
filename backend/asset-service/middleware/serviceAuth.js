import { env } from '../config/env.js';
import { ApiError } from './error.js';

/**
 * Guards the `/api/internal/*` routes. These are called service-to-service
 * (operations-service -> asset-service) and use a shared `x-service-token`
 * header instead of an end-user AccessToken, so status syncs work regardless
 * of the originating user's role.
 */
export function requireServiceToken(req, _res, next) {
  const token = req.get('x-service-token');
  if (!token || token !== env.serviceToken) {
    return next(new ApiError(401, 'SERVICE_UNAUTHORIZED', 'A valid x-service-token header is required'));
  }
  return next();
}
