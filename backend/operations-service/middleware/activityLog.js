import { recordActivity } from '../services/activityClient.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const RESOURCE_LABELS = {
  allocations: 'allocation',
  maintenance: 'maintenance',
};

const SUB_VERBS = {
  status: 'status_change',
  assign: 'assign',
  return: 'return',
  transfer: 'transfer',
};

function deriveActivity(method, originalUrl) {
  const path = String(originalUrl || '').split('?')[0];
  const parts = path.replace(/^\/api\/?/, '').split('/').filter(Boolean);

  const plural = parts[0] ?? '';
  const resource = RESOURCE_LABELS[plural] ?? (plural.replace(/s$/, '') || 'unknown');

  const NON_ID = new Set(['summary', 'stats', 'my', 'asset', '']);
  let resourceId = null;
  let sub = null;
  if (parts[1] && !NON_ID.has(parts[1])) {
    resourceId = parts[1];
    if (parts[2]) sub = parts[2];
  } else if (parts[2]) {
    sub = parts[2];
  }

  let action;
  if (method === 'POST') action = sub ? `${resource}.${sub}` : `${resource}.create`;
  else if (method === 'PATCH' || method === 'PUT') action = sub ? `${resource}.${SUB_VERBS[sub] ?? sub}` : `${resource}.update`;
  else if (method === 'DELETE') action = `${resource}.delete`;
  else action = `${resource}.${String(method).toLowerCase()}`;

  return { resource, resourceId, action };
}

function defaultSummary(action, resourceId) {
  const [resource, verb] = String(action).split('.');
  const label = verb.replace(/_/g, ' ');
  const target = resourceId ? ` ${resourceId}` : '';
  return `${label} ${resource}${target}`.replace(/\s+/g, ' ').trim();
}

/**
 * Mirror authenticated mutating operations-service requests into the unified
 * activity feed owned by the asset-service. Fire-and-forget: a logging failure
 * must never affect the response.
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
      source: 'operations-service',
    });
  });

  return next();
}

export default activityLogger;
