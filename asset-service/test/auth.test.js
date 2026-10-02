import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { startTestApp, stopTestApp, client, createUser, loginAs, ensureAdmin } from './helpers.js';

let app;
let ctx;
let admin;
let api;

before(async () => {
  ctx = await startTestApp();
  app = ctx.app;
  admin = await ensureAdmin(app);
  api = client(app, admin.header);
});

after(async () => {
  await stopTestApp(ctx);
});

describe('POST /api/auth/register', () => {
  it('registers a user as staff and never returns the password hash', async () => {
    const res = await client(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Johnson',
        email: 'Alice.Johnson@Example.com',
        password: 'Str0ngPass!',
        department: 'IT',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.email, 'alice.johnson@example.com');
    assert.equal(res.body.data.role, 'staff');
    assert.equal(res.body.data.passwordHash, undefined);
    assert.equal(res.body.data.isActive, true);
  });

  it('ignores a client-supplied role so nobody can self-register as admin', async () => {
    const res = await client(app)
      .post('/api/auth/register')
      .send({
        name: 'Escalator',
        email: 'escalator@example.com',
        password: 'Str0ngPass!',
        role: 'admin',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.role, 'staff');
  });

  it('rejects a weak password with 400', async () => {
    const res = await client(app)
      .post('/api/auth/register')
      .send({ name: 'Weak', email: 'weak@example.com', password: 'short' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.some((d) => d.field === 'password'));
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await client(app)
      .post('/api/auth/register')
      .send({ name: 'Dupe', email: 'alice.johnson@example.com', password: 'Str0ngPass!' });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EMAIL_ALREADY_EXISTS');
  });

  it('rejects a malformed email with 400', async () => {
    const res = await client(app)
      .post('/api/auth/register')
      .send({ name: 'Bad', email: 'not-an-email', password: 'Str0ngPass!' });

    assert.equal(res.status, 400);
  });
});

describe('POST /api/auth/login', () => {
  it('returns a signed token for correct credentials', async () => {
    const login = await loginAs(app, 'alice.johnson@example.com', 'Str0ngPass!');

    assert.equal(login.status, 200);
    assert.ok(login.token);
    assert.equal(login.body.tokenType, 'Bearer');
    assert.ok(login.body.expiresIn > 0);
    assert.equal(login.body.user.email, 'alice.johnson@example.com');
    assert.equal(login.body.user.passwordHash, undefined);
  });

  it('verifies the token against the shared secret', async () => {
    const login = await loginAs(app, 'alice.johnson@example.com', 'Str0ngPass!');
    const claims = jwt.verify(login.token, process.env.JWT_SECRET, {
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE.split(','),
    });

    assert.equal(claims.email, 'alice.johnson@example.com');
    assert.equal(claims.role, 'staff');
    assert.ok(claims.sub);
  });

  it('gives the same error for a wrong password and an unknown user', async () => {
    const badPassword = await loginAs(app, 'alice.johnson@example.com', 'WrongPass!1');
    const noSuchUser = await loginAs(app, 'ghost@example.com', 'Str0ngPass!');

    assert.equal(badPassword.status, 401);
    assert.equal(noSuchUser.status, 401);
    assert.equal(badPassword.body.error.message, noSuchUser.body.error.message);
  });

  it('records lastLoginAt on success', async () => {
    const before = await loginAs(app, 'alice.johnson@example.com', 'Str0ngPass!');
    assert.ok(before.user.lastLoginAt);
  });

  it('rejects an inactive account with 403', async () => {
    const { User } = await import('../models/user.model.js');
    const created = await createUser(app, admin.header, 'staff', { email: 'inactive@example.com' });
    await User.updateOne({ email: created.email }, { isActive: false });

    const res = await loginAs(app, created.email, created.password);

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'ACCOUNT_INACTIVE');
  });

  it('locks the account after 5 failed attempts', async () => {
    const created = await createUser(app, admin.header, 'staff', { email: 'lockme@example.com' });

    for (let i = 0; i < 4; i += 1) {
      const res = await loginAs(app, created.email, 'WrongPass!1');
      assert.equal(res.status, 401);
    }

    const fifth = await loginAs(app, created.email, 'WrongPass!1');
    assert.equal(fifth.status, 401);

    const locked = await loginAs(app, created.email, created.password);
    assert.equal(locked.status, 429);
    assert.equal(locked.body.error.code, 'ACCOUNT_LOCKED');
  });

  it('rejects a missing password with 400', async () => {
    const res = await client(app).post('/api/auth/login').send({ email: 'alice.johnson@example.com' });

    assert.equal(res.status, 400);
  });
});

describe('authMiddleware', () => {
  it('401s when no token is supplied', async () => {
    const res = await client(app).get('/api/assets');

    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('401s on a malformed token', async () => {
    const res = await client(app).get('/api/assets').set('Authorization', 'Bearer not.a.token');

    assert.equal(res.status, 401);
  });

  it('401s on a token signed with the wrong secret', async () => {
    const forged = jwt.sign({ sub: '000000000000000000000000', role: 'admin' }, 'wrong-secret', {
      expiresIn: '1h',
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE.split(','),
    });

    const res = await client(app).get('/api/assets').set('Authorization', `Bearer ${forged}`);

    assert.equal(res.status, 401);
    assert.match(res.body.error.message, /signature/i);
  });

  it('401s on an expired token', async () => {
    const expired = jwt.sign(
      { sub: String(admin.user.id), email: admin.user.email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '-10s', issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE.split(',') }
    );

    const res = await client(app).get('/api/assets').set('Authorization', `Bearer ${expired}`);

    assert.equal(res.status, 401);
    assert.match(res.body.error.message, /expired/i);
  });

  it('401s when the token subject no longer exists', async () => {
    const orphan = jwt.sign({ sub: '64f0a1234b567890a1b2c3d4', role: 'admin' }, process.env.JWT_SECRET, {
      expiresIn: '1h',
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE.split(','),
    });

    const res = await client(app).get('/api/assets').set('Authorization', `Bearer ${orphan}`);

    assert.equal(res.status, 401);
  });

  it('accepts a valid token', async () => {
    const res = await api.get('/api/assets');

    assert.equal(res.status, 200);
  });

  it('GET /api/auth/me returns the profile of the caller', async () => {
    const res = await api.get('/api/auth/me');

    assert.equal(res.status, 200);
    assert.equal(res.body.data.email, admin.user.email);
    assert.equal(res.body.data.role, 'admin');
  });
});

describe('roleMiddleware', () => {
  it('403s a technician trying to create an asset', async () => {
    const tech = await createUser(app, admin.header, 'technician');
    const login = await loginAs(app, tech.email, tech.password);

    const res = await client(app, login.header)
      .post('/api/assets')
      .send({ name: 'Should Not Exist', category: 'laptop' });

    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'FORBIDDEN');
  });

  it('403s staff on admin-only routes', async () => {
    const staff = await createUser(app, admin.header, 'staff');
    const login = await loginAs(app, staff.email, staff.password);

    const list = await client(app, login.header).get('/api/users');
    assert.equal(list.status, 403);

    const created = await client(app, login.header)
      .post('/api/users')
      .send({ name: 'Nope', email: 'nope@example.com', password: 'Str0ngPass!', role: 'admin' });
    assert.equal(created.status, 403);
  });

  it('lets staff write assets', async () => {
    const staff = await createUser(app, admin.header, 'staff');
    const login = await loginAs(app, staff.email, staff.password);

    const res = await client(app, login.header)
      .post('/api/assets')
      .send({ name: 'Staff Laptop', category: 'laptop' });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.createdBy, login.user.id);
  });

  it('lets a technician read assets', async () => {
    const tech = await createUser(app, admin.header, 'technician');
    const login = await loginAs(app, tech.email, tech.password);

    const res = await client(app, login.header).get('/api/assets');

    assert.equal(res.status, 200);
  });

  it('lets an admin create a user with any role', async () => {
    const res = await api
      .post('/api/users')
      .send({
        name: 'Admin Made Tech',
        email: 'admin-made-tech@example.com',
        password: 'Str0ngPass!',
        role: 'technician',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.role, 'technician');
    assert.equal(res.body.data.mustChangePassword, true);
  });

  it('rejects an invalid role on admin user creation with 400', async () => {
    const res = await api
      .post('/api/users')
      .send({ name: 'Bad Role', email: 'badrole@example.com', password: 'Str0ngPass!', role: 'superuser' });

    assert.equal(res.status, 400);
  });
});