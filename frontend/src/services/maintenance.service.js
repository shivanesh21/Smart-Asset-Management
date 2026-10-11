import { opsApi, cleanParams } from './api.js';

/** POST /api/maintenance */
export function createMaintenance(payload) {
  return opsApi.post('/api/maintenance', payload).then((r) => r.data);
}

/** GET /api/maintenance */
export function listMaintenance(params) {
  return opsApi.get('/api/maintenance', { params: cleanParams(params) }).then((r) => r.data);
}

/** GET /api/maintenance/:id */
export function getMaintenance(id) {
  return opsApi.get(`/api/maintenance/${id}`).then((r) => r.data);
}

/** GET /api/maintenance/stats */
export function getMaintenanceStats() {
  return opsApi.get('/api/maintenance/stats').then((r) => r.data);
}

/** POST /api/maintenance/:id/assign */
export function assignTechnician(id, payload) {
  return opsApi.post(`/api/maintenance/${id}/assign`, payload).then((r) => r.data);
}

/** PATCH /api/maintenance/:id/status */
export function updateMaintenanceStatus(id, payload) {
  return opsApi.patch(`/api/maintenance/${id}/status`, payload).then((r) => r.data);
}
