import axios from 'axios';

const ASSET_BASE = import.meta.env.VITE_ASSET_API_URL || 'http://localhost:3001';
const OPS_BASE   = import.meta.env.VITE_OPS_API_URL   || 'http://localhost:3002';

function makeInstance(baseURL) {
  return axios.create({
    baseURL,
    timeout: 10_000,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const assetApi = makeInstance(ASSET_BASE);
export const opsApi   = makeInstance(OPS_BASE);

/**
 * Drops empty-string / undefined / null entries from a query-param object.
 * Without this, blank params like `status=` are still sent and fail the
 * backend's `.optional()` validators (which only skip `undefined`).
 */
export function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

/** Reads the JWT stored in localStorage and attaches it as a Bearer token. */
function attachToken(config) {
  const token = localStorage.getItem('sam_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}

/** Normalises axios errors into a consistent shape: { status, code, message, details } */
function handleError(error) {
  if (error.response) {
    const { status, data } = error.response;
    const err = data?.error ?? {};
    return Promise.reject({
      status,
      code:    err.code    ?? 'API_ERROR',
      message: err.message ?? error.message ?? 'Unknown error',
      details: err.details ?? [],
    });
  }

  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return Promise.reject({
      status:  503,
      code:    'SERVICE_UNAVAILABLE',
      message: 'Service is unavailable or timed out. Please try again.',
      details: [],
    });
  }

  return Promise.reject({
    status:  0,
    code:    'NETWORK_ERROR',
    message: 'Cannot reach the server. Check your network connection.',
    details: [],
  });
}

[assetApi, opsApi].forEach((instance) => {
  instance.interceptors.request.use(attachToken);
  instance.interceptors.response.use((r) => r, handleError);
});
