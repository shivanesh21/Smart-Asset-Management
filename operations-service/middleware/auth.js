import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './error.js';

// operations-service has no Users collection. asset-service issues the token and is the only
// service that reads the User document, so this service trusts the verified claims and cannot
// re-check `isActive`. Revoking access therefore means rotating JWT_SECRET or waiting for
// expiry. See docs/auth-design.md.
export async function requireAuth(req, res, next) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Authorization bearer token is required'));
  }

  let claims;
  try {
    claims = jwt.verify(token, env.jwtSecret, {
      issuer: env.jwtIssuer,
      audience: env.jwtAudience,
    });
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token signature';
    return next(new ApiError(401, 'UNAUTHORIZED', message));
  }

  req.user = {
    id: String(claims.sub),
    email: claims.email ?? null,
    role: claims.role,
    site: claims.site ?? null,
    department: claims.department ?? null,
  };

  return next();
}

export function requireRole(...roles) {
  const allowed = roles.flat();

  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));
    }

    if (!allowed.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          'FORBIDDEN',
          `Role ${req.user.role} cannot perform this action. Required: ${allowed.join(' or ')}`
        )
      );
    }

    return next();
  };
}