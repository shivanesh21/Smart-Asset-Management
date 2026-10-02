import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';

export async function startTestApp() {
  const mongo = await MongoMemoryServer.create();

  process.env.MONGO_URI = mongo.getUri('asset_db');
  process.env.JWT_SECRET = 'test-secret-not-used-for-anything-real';
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0';

  const mod = await import('../server.js');
  await mongoose.connection.asPromise();
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

export function client(app, header) {
  const h = header ? { Authorization: header } : {};
  return {
    get: (url) => request(app).get(url).set(h),
    post: (url) => request(app).post(url).set(h),
    put: (url) => request(app).put(url).set(h),
    patch: (url) => request(app).patch(url).set(h),
    delete: (url) => request(app).delete(url).set(h),
  };
}

export async function createUser(app, adminHeader, role = 'staff', overrides = {}) {
  seq += 1;
  const email = overrides.email ?? `user${seq}.${role}@test.local`;
  const password = overrides.password ?? 'Passw0rd!23';

  const res = await client(app, adminHeader)
    .post('/api/users')
    .send({
      name: overrides.name ?? `Test ${role} ${seq}`,
      email,
      password,
      role,
      department: overrides.department ?? 'Engineering',
      site: overrides.site ?? 'HQ',
    });

  return { email, password, status: res.status, body: res.body, created: res.body.data };
}

export async function loginAs(app, email, password = 'Passw0rd!23') {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return {
    status: res.status,
    body: res.body,
    token: res.body.accessToken,
    header: res.body.accessToken ? `Bearer ${res.body.accessToken}` : undefined,
    user: res.body.user,
  };
}

export async function ensureAdmin(app, overrides = {}) {
  const { User } = await import('../models/user.model.js');
  const password = overrides.password ?? 'Admin@12345';
  const email = overrides.email ?? 'admin@test.local';

  const existing = await User.findOne({ email });
  if (!existing) {
    await User.create({
      name: 'Seeded Admin',
      email,
      passwordHash: await User.hashPassword(password),
      role: 'admin',
      isActive: true,
    });
  }

  return loginAs(app, email, password);
}