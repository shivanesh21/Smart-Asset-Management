import { dbState } from '../config/db.js';

export function health(_req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'asset-service',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

export function ready(_req, res) {
  const database = dbState();
  const ok = database === 'connected';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ready' : 'degraded',
    service: 'asset-service',
    database,
    dbName: 'asset_db',
  });
}
