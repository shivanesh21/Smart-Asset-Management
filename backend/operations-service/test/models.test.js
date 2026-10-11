import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { startTestApp, stopTestApp, uniqueTechnician } from './helpers.js';

let app;
let ctx;

before(async () => {
  ctx = await startTestApp();
  app = ctx.app;
});

after(async () => {
  await stopTestApp(ctx);
});

describe('scaffold', () => {
  it('exposes liveness', async () => {
    const res = await request(app).get('/health');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.service, 'operations-service');
  });

  it('exposes readiness against operations_db', async () => {
    const res = await request(app).get('/health/ready');

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ready');
    assert.equal(res.body.database, 'connected');
    assert.equal(res.body.dbName, 'operations_db');
  });

  it('404s an unknown route with the standard envelope', async () => {
    const res = await request(app).get('/api/nope');

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'ROUTE_NOT_FOUND');
    assert.ok(Array.isArray(res.body.error.details));
    assert.equal(res.body.error.requestId, res.headers['x-request-id']);
  });

  it('sets the usual hardening headers', async () => {
    const res = await request(app).get('/health');

    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});

describe('indexes', () => {
  it('actually creates the declared indexes', async () => {
    const names = async (collection) =>
      (await mongoose.connection.db.collection(collection).indexes()).map((i) => i.name);

    assert.ok((await names('technicians')).includes('employeeCode_1'));
    assert.ok((await names('maintenances')).includes('maintenanceId_1'));
    assert.ok((await names('allocations')).includes('asset_1'));
    assert.ok((await names('allocations')).includes('one_active_allocation_per_asset'));
  });

  it('enforces the partial unique index: one active allocation per asset', async () => {
    const { Allocation } = await import('../models/allocation.model.js');
    const asset = new mongoose.Types.ObjectId();
    const base = () => ({
      asset,
      user: new mongoose.Types.ObjectId(),
      allocatedBy: new mongoose.Types.ObjectId(),
      conditionOnHandover: 'good',
    });

    await Allocation.create(base());
    await assert.rejects(Allocation.create(base()), /duplicate key/i);
  });
});

describe('Technician model', () => {
  it('creates a technician with defaults', async () => {
    const tech = await uniqueTechnician();
    const json = tech.toJSON();

    assert.ok(json.id);
    assert.equal(json.status, 'available');
    assert.equal(json.maxConcurrentJobs, 5);
    assert.equal(json.activeJobCount, 0);
    assert.deepEqual(json.skills, ['general']);
    assert.equal(json._id, undefined);
  });

  it('uppercases employeeCode and rejects a duplicate', async () => {
    const { Technician } = await import('../models/technician.model.js');
    const code = `TECH-DUP-${Date.now()}`;
    await Technician.create({ employeeCode: code.toLowerCase(), name: 'First', email: `a.${Date.now()}@t.local` });

    const dupe = code.toLowerCase();
    await assert.rejects(
      Technician.create({ employeeCode: dupe, name: 'Second', email: `b.${Date.now()}@t.local` }),
      /duplicate key/i
    );
  });

  it('rejects an unknown status and an unknown skill', async () => {
    const { Technician } = await import('../models/technician.model.js');

    await assert.rejects(
      Technician.create({
        employeeCode: `TECH-S-${Date.now()}`,
        name: 'Bad Status',
        email: `s.${Date.now()}@t.local`,
        status: 'on_vacation',
      }),
      /status/i
    );

    await assert.rejects(
      Technician.create({
        employeeCode: `TECH-K-${Date.now()}`,
        name: 'Bad Skill',
        email: `k.${Date.now()}@t.local`,
        skills: ['teleportation'],
      }),
      /skills/i
    );
  });

  it('rejects maxConcurrentJobs below 1', async () => {
    const { Technician } = await import('../models/technician.model.js');

    await assert.rejects(
      Technician.create({
        employeeCode: `TECH-M-${Date.now()}`,
        name: 'Zero Jobs',
        email: `m.${Date.now()}@t.local`,
        maxConcurrentJobs: 0,
      }),
      /maxConcurrentJobs/i
    );
  });
});

describe('Maintenance model', () => {
  const base = (overrides = {}) => ({
    maintenanceId: `MNT-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`,
    assetId: new mongoose.Types.ObjectId(),
    assetTag: 'AST-1001',
    title: 'Laptop will not boot',
    type: 'corrective',
    reportedBy: new mongoose.Types.ObjectId(),
    ...overrides,
  });

  it('creates a maintenance record with requested status and zero cost', async () => {
    const { Maintenance } = await import('../models/maintenance.model.js');
    const job = await Maintenance.create(base());

    assert.equal(job.status, 'requested');
    assert.equal(job.priority, 'medium');
    assert.equal(job.cost.totalCost, 0);
    assert.deepEqual(job.partsUsed, []);
    assert.ok(job.id);
  });

  it('rejects a malformed maintenanceId', async () => {
    const { Maintenance } = await import('../models/maintenance.model.js');

    await assert.rejects(
      Maintenance.create(base({ maintenanceId: 'JOB-1' })),
      /maintenanceId/i
    );
  });

  it('rejects a malformed assetTag', async () => {
    const { Maintenance } = await import('../models/maintenance.model.js');

    await assert.rejects(
      Maintenance.create(base({ assetTag: 'laptop-1' })),
      /assetTag/i
    );
  });

  it('rejects an unknown maintenance type', async () => {
    const { Maintenance } = await import('../models/maintenance.model.js');

    await assert.rejects(
      Maintenance.create(base({ type: 'vibes' })),
      /type/i
    );
  });

  it('rejects a part quantity below 1', async () => {
    const { Maintenance } = await import('../models/maintenance.model.js');

    await assert.rejects(
      Maintenance.create(base({ partsUsed: [{ name: 'Battery', quantity: 0 }] })),
      /quantity/i
    );
  });

  it('rejects a duplicate maintenanceId', async () => {
    const { Maintenance } = await import('../models/maintenance.model.js');
    const maintenanceId = `MNT-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    await Maintenance.create(base({ maintenanceId }));
    await assert.rejects(Maintenance.create(base({ maintenanceId })), /duplicate key/i);
  });

  it('rejects a second active job for the same asset and technician is only advisory', async () => {
    const { Maintenance } = await import('../models/maintenance.model.js');
    const { Technician } = await import('../models/technician.model.js');
    const tech = await Technician.create({
      employeeCode: `TECH-A-${Date.now()}`,
      name: 'Assigned Tech',
      email: `a.${Date.now()}@t.local`,
    });

    const job = await Maintenance.create(base({ assignedTechnician: tech._id }));

    assert.equal(job.assignedTechnician.toString(), tech._id.toString());
  });
});

describe('Allocation model', () => {
  it('creates an active allocation with a partial unique index per asset', async () => {
    const { Allocation } = await import('../models/allocation.model.js');
    const asset = new mongoose.Types.ObjectId();
    const base = () => ({
      asset,
      user: new mongoose.Types.ObjectId(),
      allocatedBy: new mongoose.Types.ObjectId(),
      conditionOnHandover: 'good',
    });

    const first = await Allocation.create(base());
    assert.equal(first.status, 'active');
    assert.ok(first.allocatedAt);

    await assert.rejects(Allocation.create(base()), /duplicate key/i);

    await Allocation.updateOne({ _id: first._id }, { status: 'returned' });
    const replacement = await Allocation.create(base());

    assert.equal(replacement.status, 'active');
    assert.equal(await Allocation.countDocuments({ asset, status: 'active' }), 1);
    assert.equal(await Allocation.countDocuments({ asset }), 2);
  });

  it('requires a handover condition', async () => {
    const { Allocation } = await import('../models/allocation.model.js');

    await assert.rejects(
      Allocation.create({
        asset: new mongoose.Types.ObjectId(),
        user: new mongoose.Types.ObjectId(),
        allocatedBy: new mongoose.Types.ObjectId(),
      }),
      /conditionOnHandover/i
    );
  });

  it('rejects an unknown status', async () => {
    const { Allocation } = await import('../models/allocation.model.js');

    await assert.rejects(
      Allocation.create({
        asset: new mongoose.Types.ObjectId(),
        user: new mongoose.Types.ObjectId(),
        allocatedBy: new mongoose.Types.ObjectId(),
        conditionOnHandover: 'good',
        status: 'pending',
      }),
      /status/i
    );
  });
});