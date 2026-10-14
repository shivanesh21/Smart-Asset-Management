import { recordActivity, deriveActivity, defaultSummary } from '../services/activity.service.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Records one activity event after a successful (2xx/3xx) mutating request.
 *
 * Controllers may enrich the event by setting `res.locals.activity`, e.g.
 *   res.locals.activity = { action: 'asset.create', summary: `Created asset ${a.assetId}` };
 *
 * Unauthenticated writes (login/register) are logged explicitly by the auth
 * controller instead, so they don't need this middleware.
 */
export function activityLogger(req, res, next) {
  if (!MUTATING.has(req.method)) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    if (!req.user) return;

    const { resource, resourceId, action } = deriveActivity(req.method, req.originalUrl);
    const custom = res.locals.activity ?? {};

    recordActivity({
      actorId: req.user.id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: custom.action ?? action,
      resource: custom.resource ?? resource,
      resourceId: custom.resourceId ?? resourceId,
      summary: custom.summary ?? defaultSummary(custom.action ?? action, custom.resourceId ?? resourceId),
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      metadata: custom.metadata ?? null,
      source: 'asset-service',
    });
  });

  return next();
}

export default activityLogger;
