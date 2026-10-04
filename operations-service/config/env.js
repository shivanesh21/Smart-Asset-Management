import dotenv from 'dotenv';

dotenv.config();

function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${key}. Copy .env.example to .env and fill it in.`
    );
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  serviceName: 'operations-service',
  port: Number(process.env.PORT ?? 5001),
  mongoUri: required('MONGO_URI'),
  assetServiceUrl: required('ASSET_SERVICE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtIssuer: process.env.JWT_ISSUER ?? 'asset-service',
  jwtAudience: (process.env.JWT_AUDIENCE ?? 'asset-service,operations-service')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean),
  assetServiceTimeoutMs: Number(process.env.ASSET_SERVICE_TIMEOUT_MS ?? 5000),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};

export const isProduction = env.nodeEnv === 'production';