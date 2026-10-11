import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, MAX_FAILED_LOGINS, LOCKOUT_MINUTES } from '../models/user.model.js';
import { ApiError } from './error.js';

export function signToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
      role: user.role,
      site: user.site ?? null,
      department: user.department ?? null,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn, issuer: env.jwtIssuer, audience: env.jwtAudience }
  );
}

export function tokenLifetimeSeconds(token) {
  const decoded = jwt.decode(token);
  return decoded?.exp && decoded?.iat ? decoded.exp - decoded.iat : 0;
}

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

  let user;
  try {
    user = await User.findById(claims.sub).select('email role isActive');
  } catch (err) {
    return next(
      new ApiError(503, 'AUTH_UNAVAILABLE', 'Could not verify your account. Please retry.', [])
    );
  }

  if (!user) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'User for this token no longer exists'));
  }

  if (!user.isActive) {
    return next(new ApiError(403, 'ACCOUNT_INACTIVE', 'Your account is inactive'));
  }

  req.user = {
    id: String(user._id),
    email: user.email,
    role: user.role,
    site: user.site,
    department: user.department,
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

export async function registerFailedLogin(user) {
  user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;

  if (user.failedLoginAttempts >= MAX_FAILED_LOGINS) {
    user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
    user.failedLoginAttempts = 0;
  }

  await user.save();
}

export async function registerSuccessfulLogin(user) {
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();
}