import { assetApi, cleanParams } from './api.js';

/** GET /api/assets */
export function listAssets(params) {
  return assetApi.get('/api/assets', { params: cleanParams(params) }).then((r) => r.data);
}

/** GET /api/assets/:id */
export function getAsset(id) {
  return assetApi.get(`/api/assets/${id}`).then((r) => r.data);
}

/** POST /api/assets */
export function createAsset(payload) {
  return assetApi.post('/api/assets', payload).then((r) => r.data);
}

/** PATCH /api/assets/:id */
export function updateAsset(id, payload) {
  return assetApi.patch(`/api/assets/${id}`, payload).then((r) => r.data);
}

/** DELETE /api/assets/:id */
export function deleteAsset(id) {
  return assetApi.delete(`/api/assets/${id}`).then((r) => r.data);
}

/** GET /api/assets/summary */
export function getAssetStats() {
  return assetApi.get('/api/assets/summary').then((r) => r.data);
}
