import axios from 'axios';
import { auth, role } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { ApiError } from '../middleware/error.js';

export function getBaseUrl() {
  return (env.assetServiceUrl || 'http://localhost:3001').replace(/\/+$/, '');
}

export function getTimeout() {
  return Number(env.assetServiceTimeoutMs ?? 5000);
}

export function isTokenLike(str) {
  if (typeof str !== 'string') return false;
  const s = str.trim();
  return s.toLowerCase().startsWith('bearer ') || s.split('.').length === 3;
}

export function extractAuthHeader(input) {
  if (!input) return null;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    return trimmed.toLowerCase().startsWith('bearer ') ? trimmed : `Bearer ${trimmed}`;
  }

  if (typeof input === 'object') {
    if (typeof input.get === 'function') {
      const header = input.get('authorization');
      if (header) return header.trim();
    }
    if (input.headers && typeof input.headers === 'object') {
      const header = input.headers.authorization || input.headers.Authorization;
      if (header) return extractAuthHeader(header);
    }
    if (input.authorization) {
      return extractAuthHeader(input.authorization);
    }
    if (input.token) {
      return extractAuthHeader(input.token);
    }
    if (input.user?.token) {
      return extractAuthHeader(input.user.token);
    }
    if (input.req) {
      return extractAuthHeader(input.req);
    }
  }

  return null;
}

export function buildHeaders(authOrOptions = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const authHeader = extractAuthHeader(authOrOptions);
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  if (typeof authOrOptions === 'object' && authOrOptions !== null) {
    const reqId =
      authOrOptions.requestId ||
      authOrOptions.headers?.['x-request-id'] ||
      authOrOptions['x-request-id'] ||
      (typeof authOrOptions.get === 'function' ? authOrOptions.get('x-request-id') : null) ||
      authOrOptions.id;

    if (reqId) {
      headers['x-request-id'] = reqId;
    }
  }

  return headers;
}

export function formatResult(assetData, rawData) {
  if (assetData && typeof assetData === 'object') {
    if (!('data' in assetData)) {
      Object.defineProperty(assetData, 'data', {
        value: assetData,
        writable: true,
        enumerable: false,
        configurable: true,
      });
    }
    if (!('raw' in assetData)) {
      Object.defineProperty(assetData, 'raw', {
        value: rawData,
        writable: true,
        enumerable: false,
        configurable: true,
      });
    }
  }
  return assetData;
}

export function handleClientError(err) {
  if (err instanceof ApiError) {
    throw err;
  }

  if (axios.isAxiosError(err)) {
    if (err.response) {
      const { status, data } = err.response;

      // Upstream 5xx error or gateway failure -> Asset Service unavailable (503)
      if (status >= 500) {
        throw new ApiError(503, 'ASSET_SERVICE_UNAVAILABLE', 'Asset Service unavailable');
      }

      // 4xx errors forwarded with upstream code/message/details
      const errorObj = data?.error;
      const code = errorObj?.code || 'ASSET_SERVICE_ERROR';
      const message = errorObj?.message || err.message || 'Asset service request failed';
      const details = errorObj?.details || [];
      throw new ApiError(status, code, message, details);
    }

    // Network errors, timeouts, connection refused, DNS lookup errors
    throw new ApiError(503, 'ASSET_SERVICE_UNAVAILABLE', 'Asset Service unavailable');
  }

  throw new ApiError(503, 'ASSET_SERVICE_UNAVAILABLE', 'Asset Service unavailable');
}

export function createAxiosClient(options = {}) {
  return axios.create({
    baseURL: options.baseURL || getBaseUrl(),
    timeout: options.timeout ?? getTimeout(),
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
}

/**
 * Fetch asset details by ObjectId or assetTag (e.g. AST-1001).
 *
 * @param {string} id - Asset Mongo ObjectId or tag
 * @param {string|object} [authOrOptions] - Bearer token string, Express req, or options object
 * @returns {Promise<object>} The asset data object
 */
export async function getAsset(id, authOrOptions = {}) {
  if (!id) {
    throw new ApiError(400, 'INVALID_ASSET_ID', 'Asset id or tag is required');
  }

  const baseURL = getBaseUrl();
  const timeout = getTimeout();
  const cleanId = encodeURIComponent(String(id).trim());
  const url = `${baseURL}/api/assets/${cleanId}`;
  const headers = buildHeaders(authOrOptions);

  try {
    const response = await axios.get(url, {
      timeout,
      headers,
    });

    const data = response.data?.data !== undefined ? response.data.data : response.data;
    return formatResult(data, response.data);
  } catch (err) {
    return handleClientError(err);
  }
}

/**
 * Update asset lifecycle status.
 *
 * @param {string} id - Asset Mongo ObjectId or tag
 * @param {string|object} statusOrPayload - New status string or { status, reason }
 * @param {string|object} [authOrOptions] - Bearer token string, Express req, or options object
 * @param {string} [maybeReason] - Optional reason for status transition
 * @returns {Promise<object>} The updated asset data object
 */
export async function updateAssetStatus(id, statusOrPayload, authOrOptions = {}, maybeReason) {
  if (!id) {
    throw new ApiError(400, 'INVALID_ASSET_ID', 'Asset id or tag is required');
  }

  let status;
  let reason;
  let auth = authOrOptions;

  if (typeof statusOrPayload === 'object' && statusOrPayload !== null) {
    status = statusOrPayload.status;
    reason = statusOrPayload.reason;
  } else {
    status = statusOrPayload;
  }

  if (typeof maybeReason === 'string') {
    if (isTokenLike(maybeReason) && !isTokenLike(authOrOptions)) {
      reason = typeof authOrOptions === 'string' ? authOrOptions : reason;
      auth = maybeReason;
    } else {
      reason = maybeReason;
    }
  } else if (typeof authOrOptions === 'object' && authOrOptions !== null) {
    if (authOrOptions.reason && !reason) {
      reason = authOrOptions.reason;
    }
  }

  if (!status) {
    throw new ApiError(400, 'INVALID_STATUS', 'Status is required to update asset status');
  }

  const baseURL = getBaseUrl();
  const timeout = getTimeout();
  const cleanId = encodeURIComponent(String(id).trim());
  const url = `${baseURL}/api/assets/${cleanId}/status`;
  const headers = buildHeaders(auth);
  const body = { status };
  if (reason) {
    body.reason = reason;
  }

  try {
    const response = await axios.patch(url, body, {
      timeout,
      headers,
    });

    const data = response.data?.data !== undefined ? response.data.data : response.data;
    return formatResult(data, response.data);
  } catch (err) {
    return handleClientError(err);
  }
}

/**
 * Service-to-service asset lookup using the shared x-service-token header.
 * @param {string} id - Asset Mongo ObjectId or tag
 * @param {object} [options] - { requestId, ... }
 * @returns {Promise<object>} The asset data object
 */
export async function getInternalAsset(id, options = {}) {
  if (!id) {
    throw new ApiError(400, 'INVALID_ASSET_ID', 'Asset id or tag is required');
  }

  const baseURL = getBaseUrl();
  const timeout = getTimeout();
  const cleanId = encodeURIComponent(String(id).trim());
  const url = `${baseURL}/api/internal/assets/${cleanId}`;
  const headers = buildHeaders(options);
  headers['x-service-token'] = env.serviceToken;

  try {
    const response = await axios.get(url, { timeout, headers });
    const data = response.data?.data !== undefined ? response.data.data : response.data;
    return formatResult(data, response.data);
  } catch (err) {
    return handleClientError(err);
  }
}

/**
 * Service-to-service asset status transition using the shared x-service-token.
 * Works for any originating user role (asset-service does not re-check roles
 * on its /api/internal routes).
 *
 * @param {string} id - Asset Mongo ObjectId or tag
 * @param {string|object} statusOrPayload - New status string or { status, reason, actorId }
 * @param {object} [options] - { requestId, ... }
 * @returns {Promise<object>} The updated asset data object
 */
export async function updateInternalAssetStatus(id, statusOrPayload, options = {}) {
  if (!id) {
    throw new ApiError(400, 'INVALID_ASSET_ID', 'Asset id or tag is required');
  }

  let status;
  let reason;
  let actorId;

  if (typeof statusOrPayload === 'object' && statusOrPayload !== null) {
    status = statusOrPayload.status;
    reason = statusOrPayload.reason;
    actorId = statusOrPayload.actorId;
  } else {
    status = statusOrPayload;
  }

  if (!status) {
    throw new ApiError(400, 'INVALID_STATUS', 'Status is required to update asset status');
  }

  const baseURL = getBaseUrl();
  const timeout = getTimeout();
  const cleanId = encodeURIComponent(String(id).trim());
  const url = `${baseURL}/api/internal/assets/${cleanId}/status`;
  const headers = buildHeaders(options);
  headers['x-service-token'] = env.serviceToken;
  const body = { status };
  if (reason) body.reason = reason;
  if (actorId) body.actorId = actorId;

  try {
    const response = await axios.patch(url, body, { timeout, headers });
    const data = response.data?.data !== undefined ? response.data.data : response.data;
    return formatResult(data, response.data);
  } catch (err) {
    return handleClientError(err);
  }
}

export class AssetClient {
  constructor(defaultAuth = {}, options = {}) {
    this.defaultAuth = defaultAuth;
    this.baseURL = options.baseURL || getBaseUrl();
    this.timeout = options.timeout ?? getTimeout();
  }

  async getAsset(id, authOrOptions) {
    const auth = authOrOptions || this.defaultAuth;
    return getAsset(id, auth);
  }

  async updateAssetStatus(id, status, authOrOptions, maybeReason) {
    const auth = (authOrOptions && Object.keys(authOrOptions).length > 0) ? authOrOptions : this.defaultAuth;
    return updateAssetStatus(id, status, auth, maybeReason);
  }
}

export function createAssetClient(defaultAuth, options) {
  return new AssetClient(defaultAuth, options);
}

export const assetClient = {
  getAsset,
  updateAssetStatus,
  getInternalAsset,
  updateInternalAssetStatus,
  createAssetClient,
  AssetClient,
  extractAuthHeader,
  buildHeaders,
  handleClientError,
  getBaseUrl,
  getTimeout,
};

export default assetClient;
export { auth, role };
