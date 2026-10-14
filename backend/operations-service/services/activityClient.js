import axios from 'axios';
import { env } from '../config/env.js';
import { getBaseUrl, getTimeout } from './assetClient.js';

/**
 * Best-effort: push an activity event to the asset-service (which owns the
 * unified activity feed) using the shared service token. Never throws.
 */
export async function recordActivity(entry = {}) {
  if (!entry.action) return null;

  try {
    const response = await axios.post(`${getBaseUrl()}/api/internal/activity`, entry, {
      timeout: getTimeout(),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-service-token': env.serviceToken,
      },
    });
    return response.data?.data ?? null;
  } catch (err) {
    console.warn(`[activity] could not record "${entry.action}": ${err.message}`);
    return null;
  }
}

export default { recordActivity };
