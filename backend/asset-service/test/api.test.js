import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { startTestApp, stopTestApp, client, ensureAdmin } from './helpers.js';

let app;
let ctx;
let api;

before(async () => {
  ctx = await startTestApp();
  app = ctx.app;
  const admin = await ensureAdmin(app);
  api = client(app, admin.header);
});

after(async () => {
  await stopTestApp(ctx);
});

const newAsset = (overrides = {}) => ({
  name: 'Dell Latitude 5440',
  category: 'laptop',
  department: 'Engineering',
  serialNumber: 'DL5440-0001',
  purchaseDate: '2026-01-15',
  purchaseCost: 78000,
  ...overrides,
});

describe('POST /api/assets', () => {
  it('creates an asset and auto-generates assetId AST-1001', async () => {
    const res = await api.post('/api/assets').send(newAsset());

    assert.equal(res.status, 201);
    assert.equal(res.body.data.assetId, 'AST-1001');
    assert.equal(res.body.data.name, 'Dell Latitude 5440');
    assert.equal(res.body.data.status, 'draft');
    assert.equal(res.body.data.condition, 'new');
    assert.ok(res.body.data.id);
    assert.equal(res.body.data.passwordHash, undefined);
  });

  it('increments assetId sequentially on the next create', async () => {
    const res = await api.post('/api/assets')
      .send(newAsset({ serialNumber: 'DL5440-0002', name: 'HP EliteBook 840' }));

    assert.equal(res.status, 201);
    assert.equal(res.body.data.assetId, 'AST-1002');
  });

  it('ignores a client-supplied assetId so ids cannot be forged', async () => {
    const res = await api.post('/api/assets')
      .send(newAsset({ assetId: 'AST-9999', serialNumber: 'FORGE-1' }));

    assert.equal(res.status, 201);
    assert.notEqual(res.body.data.assetId, 'AST-9999');
    assert.equal(res.body.data.assetId, 'AST-1003');
  });

  it('rejects a missing name with 400 and field details', async () => {
    const res = await api.post('/api/assets').send({ category: 'laptop' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.some((d) => d.field === 'name'));
  });

  it('rejects an unknown category with 400', async () => {
    const res = await api.post('/api/assets')
      .send(newAsset({ category: 'spaceship', serialNumber: 'BAD-CAT-1' }));

    assert.equal(res.status, 400);
    assert.ok(res.body.error.details.some((d) => d.field === 'category'));
  });

  it('rejects a duplicate serialNumber with 409', async () => {
    const res = await api.post('/api/assets').send(newAsset());

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'SERIAL_NUMBER_EXISTS');
  });

  it('allows multiple assets with no serialNumber (sparse unique)', async () => {
    const a = await api.post('/api/assets').send(newAsset({ serialNumber: undefined, name: 'No SN A' }));
    const b = await api.post('/api/assets').send(newAsset({ serialNumber: undefined, name: 'No SN B' }));

    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
  });
});

describe('GET /api/assets', () => {
  it('returns a paginated envelope', async () => {
    const res = await api.get('/api/assets').query({ page: 1, limit: 3 });

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length <= 3);
    assert.equal(res.body.meta.page, 1);
    assert.equal(res.body.meta.limit, 3);
    assert.ok(res.body.meta.total >= 5);
    assert.equal(typeof res.body.meta.totalPages, 'number');
  });

  it('never leaks _id or __v', async () => {
    const res = await api.get('/api/assets');

    assert.equal(res.status, 200);
    for (const item of res.body.data) {
      assert.ok(item.id);
      assert.equal(item._id, undefined);
      assert.equal(item.__v, undefined);
    }
  });

  it('rejects an invalid limit with 400', async () => {
    const res = await api.get('/api/assets').query({ limit: 500 });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });
});

describe('GET /api/assets/:id', () => {
  it('finds an asset by Mongo ObjectId', async () => {
    const created = await api.post('/api/assets')
      .send(newAsset({ serialNumber: 'LOOKUP-1', name: 'Lookup By Id' }));

    const res = await api.get(`/api/assets/${created.body.data.id}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.assetId, created.body.data.assetId);
  });

  it('finds an asset by assetId tag', async () => {
    const res = await api.get('/api/assets/AST-1001');

    assert.equal(res.status, 200);
    assert.equal(res.body.data.assetId, 'AST-1001');
    assert.equal(res.body.data.name, 'Dell Latitude 5440');
  });

  it('returns 400 for a malformed id', async () => {
    const res = await api.get('/api/assets/not-an-id');

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('returns 404 for a well-formed id that does not exist', async () => {
    const res = await api.get('/api/assets/64f0a1234b567890a1b2c3d4');

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ASSET_NOT_FOUND');
  });
});

describe('GET /health', () => {
  it('reports ok', async () => {
    const res = await api.get('/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('reports ready once the database is connected', async () => {
    const res = await api.get('/health/ready');

    assert.equal(res.status, 200);
    assert.equal(res.body.database, 'connected');
  });
});