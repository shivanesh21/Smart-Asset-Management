import { assetApi, cleanParams } from './api.js';

/** GET /api/users — admin only. */
export function listUsers(params = {}) {
  return assetApi.get('/api/users', { params: cleanParams(params) }).then((r) => r.data);
}

/** GET /api/activity — admin only, unified "who did what" feed. */
export function listActivity(params = {}) {
  return assetApi
    .get('/api/activity', { params: cleanParams(params) })
    .then((r) => r.data);
}
