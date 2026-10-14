import { Activity } from '../models/activity.model.js';

/**
 * Best-effort activity recorder. Never throws — auditing must not break the
 * request that triggered it.
 *
 * @param {object} entry
 * @param {string|import('mongoose').Types.ObjectId} [entry.actorId]
 * @param {string} entry.actorEmail
 * @param {string} entry.actorRole
 * @param {string} entry.action       — machine code, e.g. "asset.create"
 * @param {string} [entry.resource]   — e.g. "asset"
 * @param {string} [entry.resourceId]
 * @param {string} [entry.summary]    — human one-liner
 * @param {string} [entry.method]
 * @param {string} [entry.path]
 * @param {number} [entry.statusCode]
 * @param {string} [entry.ip]
 * @param {string} [entry.userAgent]
 * @param {object} [entry.metadata]
 * @param {string} [entry.source]
 */
export async function recordActivity(entry = {}) {
  if (!entry.action) return null;

  try {
    return await Activity.create({
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ? String(entry.actorEmail).toLowerCase() : null,
      actorRole: entry.actorRole ?? null,
      action: entry.action,
      resource: entry.resource ?? null,
      resourceId: entry.resourceId != null ? String(entry.resourceId) : null,
      summary: entry.summary ?? null,
      method: entry.method ?? null,
      path: entry.path ?? null,
      statusCode: entry.statusCode ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ? String(entry.userAgent).slice(0, 300) : null,
      metadata: entry.metadata ?? null,
      source: entry.source ?? 'asset-service',
    });
  } catch {
    return null;
  }
}

const RESOURCE_LABELS = {
  assets: 'asset',
  allocations: 'allocation',
  maintenance: 'maintenance',
  users: 'user',
  auth: 'auth',
  activity: 'activity',
};

const SUB_VERBS = {
  status: 'status_change',
  assign: 'assign',
  return: 'return',
  transfer: 'transfer',
};

/** Derive { resource, resourceId, action } from an HTTP request. */
export function deriveActivity(method, originalUrl) {
  const path = String(originalUrl || '').split('?')[0];
  const parts = path.replace(/^\/api\/?/, '').split('/').filter(Boolean);

  const plural = parts[0] ?? '';
  const resource = RESOURCE_LABELS[plural] ?? (plural.replace(/s$/, '') || 'unknown');

  // Skip non-id second segments like "summary", "stats", "my".
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

/** Fallback human summary when a controller did not supply a richer one. */
export function defaultSummary(action, resourceId) {
  const [resource, verb] = String(action).split('.');
  const verbLabels = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
    status_change: 'Changed status of',
    assign: 'Assigned',
    return: 'Returned',
    transfer: 'Transferred',
    login: 'Signed in',
    register: 'Registered',
  };
  const label = verbLabels[verb] ?? `${verb} `;
  const target = resourceId ? ` ${resourceId}` : '';
  return `${label} ${resource}${target}`.replace(/\s+/g, ' ').trim();
}
