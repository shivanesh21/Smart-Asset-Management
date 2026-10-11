import { opsApi, cleanParams } from './api.js';

/** POST /api/allocations */
export function createAllocation(payload) {
  return opsApi.post('/api/allocations', payload).then((r) => r.data);
}

/** GET /api/allocations */
export function listAllocations(params) {
  return opsApi.get('/api/allocations', { params: cleanParams(params) }).then((r) => r.data);
}

/** GET /api/allocations/my */
export function myAllocations() {
  return opsApi.get('/api/allocations/my').then((r) => r.data);
}

/** GET /api/allocations/asset/:assetId */
export function allocationHistory(assetId) {
  return opsApi.get(`/api/allocations/asset/${assetId}`).then((r) => r.data);
}

/** POST /api/allocations/:id/return */
export function returnAllocation(id, payload) {
  return opsApi.post(`/api/allocations/${id}/return`, payload).then((r) => r.data);
}

/** POST /api/allocations/:id/transfer */
export function transferAllocation(id, payload) {
  return opsApi.post(`/api/allocations/${id}/transfer`, payload).then((r) => r.data);
}
