import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { startTestApp, stopTestApp, client, ensureAdmin } from './helpers.js';

let app;
let ctx;
let api;
let admin;

before(async () => {
  ctx = await startTestApp();
  app = ctx.app;
  admin = await ensureAdmin(app);
  api = client(app, admin.header);
});

after(async () => {
  await stopTestApp(ctx);
});

const ERROR_KEYS = ['code', 'message', 'details', 'requestId'];

const assertErrorShape = (res, expectedStatus, expectedCode) => {
  assert.equal(res.status, expectedStatus, JSON.stringify(res.body));
  assert.equal(res.body.error.code, expectedCode);

  assert.deepEqual(Object.keys(res.body), ['error']);
  assert.deepEqual(Object.keys(res.body.error).sort(), [...ERROR_KEYS].sort());
  assert.equal(typeof res.body.error.message, 'string');
  assert.ok(Array.isArray(res.body.error.details));
  assert.equal(typeof res.body.error.requestId, 'string');

  assert.equal(res.body.error.requestId, res.headers['x-request-id']);
  assert.equal(res.body.error.stack, undefined);
};

describe('error envelope', () => {
  it('404s an unknown route with a consistent envelope', async () => {
    const res = await client(app, admin.header).get('/api/nope');

    assertErrorShape(res, 404, 'ROUTE_NOT_FOUND');
    assert.match(res.body.error.message, /GET \/api\/nope/);
  });

  it('echoes a client-supplied x-request-id', async () => {
    const res = await request(app)
      .get('/api/assets')
      .set('Authorization', admin.header)
      .set('x-request-id', 'my-trace-id-123');

    assert.equal(res.status, 200);
    assert.equal(res.headers['x-request-id'], 'my-trace-id-123');
  });

  it('attaches a requestId even when body parsing fails', async () => {
    const res = await request(app)
      .post('/api/assets')
      .set('Authorization', admin.header)
      .set('Content-Type', 'application/json')
      .send('{"name": "broken",}');

    assert.ok(res.body.error.requestId, 'requestId must survive a parse failure');
    assert.equal(res.body.error.requestId, res.headers['x-request-id']);
  });

  it('400s malformed JSON', async () => {
    const res = await request(app)
      .post('/api/assets')
      .set('Authorization', admin.header)
      .set('Content-Type', 'application/json')
      .send('{"name": "broken",,}');

    assertErrorShape(res, 400, 'MALFORMED_JSON');
  });

  it('413s a body over the 1MB limit', async () => {
    const res = await request(app)
      .post('/api/assets')
      .set('Authorization', admin.header)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'x'.repeat(1024 * 1024 + 512), category: 'laptop' }));

    assertErrorShape(res, 413, 'PAYLOAD_TOO_LARGE');
  });

  it('400s a validator failure with field-level details', async () => {
    const res = await api.post('/api/assets').send({ category: 'spaceship' });

    assertErrorShape(res, 400, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.length > 0);
    assert.ok(res.body.error.details.every((d) => d.field && d.message));
  });

  it('400s a malformed id before it reaches the database', async () => {
    const res = await api.get('/api/assets/not-a-real-id');

    assertErrorShape(res, 400, 'VALIDATION_ERROR');
  });

  it('401s a missing token', async () => {
    const res = await request(app).get('/api/assets');

    assertErrorShape(res, 401, 'UNAUTHORIZED');
  });

  it('401s a garbage token', async () => {
    const res = await request(app).get('/api/assets').set('Authorization', 'Bearer not.a.jwt');

    assertErrorShape(res, 401, 'UNAUTHORIZED');
  });

  it('404s a missing asset', async () => {
    const res = await api.get('/api/assets/AST-9999');

    assertErrorShape(res, 404, 'ASSET_NOT_FOUND');
  });

  it('409s a duplicate serial number', async () => {
    const body = { name: 'Dup', category: 'laptop', serialNumber: 'DUP-0001' };

    const first = await api.post('/api/assets').send(body);
    assert.equal(first.status, 201);

    const second = await api.post('/api/assets').send(body);
    assertErrorShape(second, 409, 'SERIAL_NUMBER_EXISTS');
  });

  it('409s an invalid status transition', async () => {
    const created = await api
      .post('/api/assets')
      .send({ name: 'Transitions', category: 'laptop' })
      .then((r) => r.body.data);

    const res = await api.patch(`/api/assets/${created.id}/status`).send({ status: 'disposed' });

    assertErrorShape(res, 409, 'INVALID_TRANSITION');
    assert.equal(res.body.error.details[0].field, 'status');
  });

  it('404s an already soft-deleted asset', async () => {
    const created = await api
      .post('/api/assets')
      .send({ name: 'Doomed', category: 'laptop' })
      .then((r) => r.body.data);

    const del = await api.delete(`/api/assets/${created.id}`);
    assert.equal(del.status, 204);

    const res = await api.get(`/api/assets/${created.id}`);
    assertErrorShape(res, 404, 'ASSET_NOT_FOUND');
  });

  it('never returns an error key on a success response', async () => {
    const res = await api.get('/api/assets/AST-1001');

    assert.equal(res.status, 200);
    assert.equal(res.body.error, undefined);
    assert.ok(res.body.data);
  });
});

describe('normalizeError', () => {
  it('maps a mongoose CastError to INVALID_ID', async () => {
    const { normalizeError } = await import('../middleware/error.js');
    const cast = Object.assign(new Error('Cast to ObjectId failed'), {
      name: 'CastError',
      kind: 'ObjectId',
      value: 'abc',
      path: '_id',
    });

    const normalized = normalizeError(cast);

    assert.equal(normalized.status, 400);
    assert.equal(normalized.code, 'INVALID_ID');
  });

  it('maps a duplicate key error to 409 DUPLICATE_KEY with the field name', async () => {
    const { normalizeError } = await import('../middleware/error.js');
    const dup = Object.assign(new Error('E11000 duplicate key'), {
      code: 11000,
      keyValue: { serialNumber: 'DUP-9' },
    });

    const normalized = normalizeError(dup);

    assert.equal(normalized.status, 409);
    assert.equal(normalized.code, 'DUPLICATE_KEY');
    assert.equal(normalized.details[0].field, 'serialNumber');
  });

  it('maps a mongoose ValidationError to field-level details', async () => {
    const { normalizeError } = await import('../middleware/error.js');
    const invalid = Object.assign(new Error('validation failed'), {
      name: 'ValidationError',
      errors: { name: { message: 'Path `name` is required' } },
    });

    const normalized = normalizeError(invalid);

    assert.equal(normalized.status, 400);
    assert.equal(normalized.code, 'VALIDATION_ERROR');
    assert.deepEqual(normalized.details, [
      { field: 'name', message: 'Path `name` is required' },
    ]);
  });

  it('collapses an unknown throw into a 500 with no leaked detail', async () => {
    const { normalizeError } = await import('../middleware/error.js');
    const normalized = normalizeError(new Error('mongo connection pool exhausted'));

    assert.equal(normalized.status, 500);
    assert.equal(normalized.code, 'INTERNAL_ERROR');
    assert.equal(normalized.message, 'Internal server error');
  });

  it('masks 5xx messages in production but keeps 4xx messages', async () => {
    const { errorHandler, ApiError } = await import('../middleware/error.js');
    const { env } = await import('../config/env.js');
    const original = env.nodeEnv;

    const capture = () => {
      const payload = {};
      const res = {
        headersSent: false,
        status(code) {
          payload.status = code;
          return this;
        },
        json(body) {
          payload.body = body;
          return this;
        },
      };
      return { res, payload };
    };

    try {
      env.nodeEnv = 'production';
      const { res, payload } = capture();
      errorHandler(new Error('mongo connection pool exhausted'), { id: 'r1', method: 'GET', originalUrl: '/x' }, res, () => {});
      assert.equal(payload.status, 500);
      assert.equal(payload.body.error.message, 'Internal server error');
      assert.equal(payload.body.error.code, 'INTERNAL_ERROR');
      assert.equal(payload.body.error.requestId, 'r1');

      env.nodeEnv = 'production';
      const second = capture();
      errorHandler(new Error('Route GET /x not found'), { id: 'r2', method: 'GET', originalUrl: '/x' }, second.res, () => {});
      assert.equal(second.payload.status, 500);
      assert.equal(second.payload.body.error.message, 'Internal server error');

      const third = capture();
      errorHandler(
        new ApiError(404, 'ASSET_NOT_FOUND', 'Asset AST-9999 not found'),
        { id: 'r3', method: 'GET', originalUrl: '/x' },
        third.res,
        () => {}
      );
      assert.equal(third.payload.body.error.message, 'Asset AST-9999 not found');
    } finally {
      env.nodeEnv = original;
    }
  });
});

describe('asset write protection', () => {
  it('rejects every write verb for staff and technician alike', async () => {
    const { createUser, loginAs } = await import('./helpers.js');

    for (const role of ['staff', 'technician']) {
      const user = await createUser(app, admin.header, role);
      const { header } = await loginAs(app, user.email, user.password);
      const asUser = client(app, header);

      const asset = await api
        .post('/api/assets')
        .send({ name: `Admin owned ${role}`, category: 'laptop' })
        .then((r) => r.body.data);

      const attempts = [
        ['POST', await asUser.post('/api/assets').send({ name: 'X', category: 'laptop' })],
        ['PUT', await asUser.put(`/api/assets/${asset.id}`).send({ name: 'X', category: 'laptop' })],
        ['PATCH', await asUser.patch(`/api/assets/${asset.id}`).send({ name: 'X' })],
        [
          'PATCH status',
          await asUser.patch(`/api/assets/${asset.id}/status`).send({ status: 'in_stock' }),
        ],
        ['DELETE', await asUser.delete(`/api/assets/${asset.id}`)],
      ];

      for (const [verb, res] of attempts) {
        assert.equal(res.status, 403, `${role} ${verb} should be forbidden`);
        assert.equal(res.body.error.code, 'FORBIDDEN');
        assert.match(res.body.error.message, /admin/);
      }

      const read = await asUser.get(`/api/assets/${asset.id}`);
      assert.equal(read.status, 200, `${role} should still be able to read`);
    }
  });

  it('never leaks createdBy for a rejected write', async () => {
    const { createUser, loginAs } = await import('./helpers.js');
    const staff = await createUser(app, admin.header, 'staff');
    const { header } = await loginAs(app, staff.email, staff.password);

    const res = await client(app, header)
      .post('/api/assets')
      .send({ name: 'Ghost', category: 'laptop' });

    assert.equal(res.status, 403);
    assert.equal(res.body.data, undefined);
  });
});