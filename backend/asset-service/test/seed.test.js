import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const run = promisify(execFile);

let mongo;
let uri;
let users;

const runSeed = () =>
  run(process.execPath, ['scripts/seed.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MONGO_URI: uri,
      JWT_SECRET: 'seed-test-secret',
      NODE_ENV: 'test',
    },
  });

before(async () => {
  mongo = await MongoMemoryServer.create();
  uri = mongo.getUri('asset_db');
  await mongoose.connect(uri);
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongo.stop();
});

describe('seed script', () => {
  it('creates one admin, one staff and one technician', async () => {
    const { stdout } = await runSeed();
    const { User } = await import('../models/user.model.js');

    users = await User.find().sort({ role: 1 }).lean();

    assert.equal(users.length, 3);

    const roles = users.map((u) => u.role).sort();
    assert.deepEqual(roles, ['admin', 'staff', 'technician']);

    assert.match(stdout, /created admin/);
    assert.match(stdout, /created staff/);
    assert.match(stdout, /created technician/);
  });

  it('stores passwords hashed, never in plaintext', async () => {
    const { User } = await import('../models/user.model.js');

    for (const user of users) {
      const withHash = await User.findById(user._id).select('+passwordHash').lean();
      assert.ok(withHash.passwordHash);
      assert.match(withHash.passwordHash, /^\$2[aby]\$/);
      assert.equal(user.passwordHash, undefined);
    }
  });

  it('produces logins that actually work', async () => {
    const { User } = await import('../models/user.model.js');

    const admin = users.find((u) => u.role === 'admin');
    const doc = await User.findOne({ email: admin.email }).select('+passwordHash');

    const matches = await doc.verifyPassword('Admin@12345');
    const wrong = await doc.verifyPassword('NotThePassword1!');

    assert.equal(matches, true);
    assert.equal(wrong, false);
  });

  it('is idempotent: a second run skips existing users', async () => {
    const { stdout } = await runSeed();
    const { User } = await import('../models/user.model.js');

    assert.equal(await User.countDocuments(), 3);
    assert.equal((stdout.match(/already exists/g) ?? []).length, 3);
  });
});