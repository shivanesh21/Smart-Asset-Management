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

const unique = () => Math.random().toString(36).slice(2, 8).toUpperCase();

const createAsset = async (overrides = {}) => {
  const res = await api.post('/api/assets')
    .send({
      name: `Asset ${unique()}`,
      category: 'laptop',
      department: 'Engineering',
      serialNumber: `SN-${unique()}`,
      ...overrides,
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data;
};

describe('PUT /api/assets/:id', () => {
  it('replaces mutable fields', async () => {
    const asset = await createAsset({ name: 'Original Name', vendor: 'CDW' });

    const res = await api.put(`/api/assets/${asset.id}`).send({
      name: 'Replaced Name',
      category: 'desktop',
      serialNumber: asset.serialNumber,
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, 'Replaced Name');
    assert.equal(res.body.data.category, 'desktop');
  });

  it('requires name and category', async () => {
    const asset = await createAsset();

    const res = await api.put(`/api/assets/${asset.id}`).send({ category: 'desktop' });

    assert.equal(res.status, 400);
    assert.ok(res.body.error.details.some((d) => d.field === 'name'));
  });

  it('never changes assetId', async () => {
    const asset = await createAsset();

    const res = await api.put(`/api/assets/${asset.id}`)
      .send({ name: 'Renamed', category: 'laptop', assetId: 'AST-7777' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.assetId, asset.assetId);
  });

  it('returns 404 for an unknown asset', async () => {
    const res = await api.put('/api/assets/64f0a1234b567890a1b2c3d4')
      .send({ name: 'Nope', category: 'laptop' });

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ASSET_NOT_FOUND');
  });
});

describe('PATCH /api/assets/:id', () => {
  it('updates only the provided fields', async () => {
    const asset = await createAsset({ name: 'Keep Me', vendor: 'CDW' });

    const res = await api.patch(`/api/assets/${asset.id}`)
      .send({ department: 'Finance' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.department, 'Finance');
    assert.equal(res.body.data.name, 'Keep Me');
    assert.equal(res.body.data.vendor, 'CDW');
  });

  it('rejects a duplicate serialNumber with 409', async () => {
    const a = await createAsset();
    const b = await createAsset();

    const res = await api.patch(`/api/assets/${b.id}`)
      .send({ serialNumber: a.serialNumber });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'SERIAL_NUMBER_EXISTS');
  });
});

describe('PATCH /api/assets/:id/status', () => {
  it('allows a valid transition', async () => {
    const asset = await createAsset();

    const res = await api.patch(`/api/assets/${asset.id}/status`)
      .send({ status: 'in_stock', reason: 'Received from vendor PO-4471' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'in_stock');
  });

  it('rejects an invalid transition with 409 and lists allowed states', async () => {
    const asset = await createAsset({ status: 'draft' });

    const res = await api.patch(`/api/assets/${asset.id}/status`)
      .send({ status: 'disposed' });

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'INVALID_TRANSITION');
    assert.match(res.body.error.details[0].message, /in_stock/);
  });

  it('is idempotent when the status is unchanged', async () => {
    const asset = await createAsset({ status: 'draft' });

    const res = await api.patch(`/api/assets/${asset.id}/status`)
      .send({ status: 'draft' });

    assert.equal(res.status, 200);
  });

  it('rejects an unknown status with 400', async () => {
    const asset = await createAsset();

    const res = await api.patch(`/api/assets/${asset.id}/status`)
      .send({ status: 'teleported' });

    assert.equal(res.status, 400);
  });

  it('treats disposed as terminal', async () => {
    const asset = await createAsset();
    await api.patch(`/api/assets/${asset.id}/status`).send({ status: 'in_stock' });
    await api.patch(`/api/assets/${asset.id}/status`).send({ status: 'disposed' });

    const res = await api.patch(`/api/assets/${asset.id}/status`)
      .send({ status: 'in_stock' });

    assert.equal(res.status, 409);
  });
});

describe('DELETE /api/assets/:id', () => {
  it('Rule 2: refuses to delete an allocated asset with 409', async () => {
    const asset = await createAsset();
    await api.patch(`/api/assets/${asset.id}/status`).send({ status: 'in_stock' });
    await api.patch(`/api/assets/${asset.id}/status`).send({ status: 'assigned' });

    const res = await api.delete(`/api/assets/${asset.id}`);

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'ASSET_HAS_ACTIVE_ALLOCATION');
  });

  it('refuses to delete an asset under maintenance with 409', async () => {
    const asset = await createAsset();
    await api.patch(`/api/assets/${asset.id}/status`).send({ status: 'in_stock' });
    await api.patch(`/api/assets/${asset.id}/status`).send({ status: 'in_maintenance' });

    const res = await api.delete(`/api/assets/${asset.id}`);

    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'ASSET_IN_MAINTENANCE');
  });

  it('deletes an unallocated asset with 204', async () => {
    const asset = await createAsset();

    const res = await api.delete(`/api/assets/${asset.id}`);
    assert.equal(res.status, 204);
    assert.equal(res.text, '');

    const after = await api.get(`/api/assets/${asset.id}`);
    assert.equal(after.status, 404);
  });

  it('hides soft-deleted assets from the list', async () => {
    const asset = await createAsset({ name: `Ghost ${unique()}` });
    await api.delete(`/api/assets/${asset.id}`);

    const res = await api.get('/api/assets').query({ search: asset.name });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0);
  });

  it('returns 404 when deleting twice', async () => {
    const asset = await createAsset();
    await api.delete(`/api/assets/${asset.id}`);

    const res = await api.delete(`/api/assets/${asset.id}`);

    assert.equal(res.status, 404);
  });
});

describe('GET /api/assets filters', () => {
  it('filters by category', async () => {
    const tag = unique();
    await createAsset({ name: `Filt Cat ${tag}`, category: 'printer' });

    const res = await api.get('/api/assets').query({ category: 'printer', search: tag });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].category, 'printer');
  });

  it('filters by status', async () => {
    const tag = unique();
    await createAsset({ name: `Filt Status ${tag}`, status: 'retired' });

    const res = await api.get('/api/assets').query({ status: 'retired', search: tag });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].status, 'retired');
  });

  it('filters by department', async () => {
    const tag = unique();
    const dept = `Dept-${unique()}`;
    await createAsset({ name: `Filt Dept ${tag}`, department: dept });

    const res = await api.get('/api/assets').query({ department: dept });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
    assert.ok(res.body.data.every((a) => a.department === dept));
  });

  it('searches across name and assetId', async () => {
    const asset = await createAsset({ name: `Searchable ${unique()}` });

    const byName = await api.get('/api/assets').query({ search: asset.name });
    assert.equal(byName.body.data.length, 1);

    const byId = await api.get('/api/assets').query({ search: asset.assetId });
    assert.equal(byId.body.data.length, 1);
  });

  it('still accepts q as an alias for search', async () => {
    const asset = await createAsset({ name: `Alias ${unique()}` });

    const res = await api.get('/api/assets').query({ q: asset.name });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
  });

  it('escapes regex metacharacters in search', async () => {
    await createAsset({ name: `Literal (Parens) ${unique()}` });

    const res = await api.get('/api/assets').query({ search: '(Parens)' });

    assert.equal(res.status, 200);
    assert.ok(res.body.data.length >= 1);
  });

  it('paginates correctly', async () => {
    const tag = unique();
    for (let i = 0; i < 5; i += 1) {
      await createAsset({ name: `Page ${tag} ${i}` });
    }

    const page1 = await api.get('/api/assets').query({ search: `Page ${tag}`, page: 1, limit: 2, sort: 'name' });
    const page2 = await api.get('/api/assets').query({ search: `Page ${tag}`, page: 2, limit: 2, sort: 'name' });

    assert.equal(page1.body.data.length, 2);
    assert.equal(page2.body.data.length, 2);
    assert.equal(page1.body.meta.total, 5);
    assert.equal(page1.body.meta.totalPages, 3);
    assert.notEqual(page1.body.data[0].id, page2.body.data[0].id);
  });

  it('rejects an unsupported sort field with 400', async () => {
    const res = await api.get('/api/assets').query({ sort: 'password' });

    assert.equal(res.status, 400);
  });
});