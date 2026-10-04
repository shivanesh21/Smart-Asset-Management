import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

export async function startTestApp() {
  const mongo = await MongoMemoryServer.create();

  process.env.MONGO_URI = mongo.getUri('operations_db');
  process.env.JWT_SECRET = 'test-secret-not-used-for-anything-real';
  process.env.ASSET_SERVICE_URL = 'http://localhost:3001';
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0';

  const mod = await import('../server.js');
  await mongoose.connection.asPromise();

  await Promise.all([
    import('../models/allocation.model.js'),
    import('../models/technician.model.js'),
    import('../models/maintenance.model.js'),
  ]);
  await mongoose.syncIndexes();

  return { app: mod.app, server: mod.server, mongo };
}

export async function stopTestApp(ctx) {
  if (!ctx) {
    return;
  }
  ctx.server?.close();
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await ctx.mongo.stop();
}

let seq = 0;

export function signToken(claims = {}) {
  return import('jsonwebtoken').then(({ default: jwt }) =>
    jwt.sign(
      {
        sub: '64f0a1234b567890a1b2c3d4',
        email: 'admin@test.local',
        role: 'admin',
        site: 'HQ',
        department: 'Engineering',
        ...claims,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1h',
        issuer: process.env.JWT_ISSUER ?? 'asset-service',
        audience: (process.env.JWT_AUDIENCE ?? 'asset-service,operations-service')
          .split(',')
          .map((a) => a.trim()),
      }
    )
  );
}

export async function uniqueTechnician(overrides = {}) {
  seq += 1;
  const { Technician } = await import('../models/technician.model.js');

  return Technician.create({
    employeeCode: `TECH-${seq}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    name: `Technician ${seq}`,
    email: `tech${seq}.${Date.now()}@test.local`,
    status: 'available',
    skills: ['general'],
    ...overrides,
  });
}