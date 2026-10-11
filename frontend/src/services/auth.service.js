import { assetApi } from './api.js';

/** POST /api/auth/login */
export function login(email, password) {
  return assetApi.post('/api/auth/login', { email, password }).then((r) => r.data);
}

/** POST /api/auth/register */
export function register(payload) {
  return assetApi.post('/api/auth/register', payload).then((r) => r.data);
}

/** GET /api/auth/me */
export function me() {
  return assetApi.get('/api/auth/me').then((r) => r.data);
}
