import mongoose from 'mongoose';
import { Maintenance } from '../models/maintenance.model.js';
import { Technician } from '../models/technician.model.js';
import { nextMaintenanceId } from '../models/counter.model.js';
import { assetClient } from '../services/assetClient.js';
import { ApiError } from '../middleware/error.js';

const TECH_POPULATE = { path: 'assignedTechnician', select: 'email name employeeCode' };

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value) && /^[0-9a-fA-F]{24}$/.test(String(value));
}

/** Builds a Mongo filter from either a 24-hex ObjectId or a human Req ID (MNT-…). */
function refFilter(ref) {
  const value = String(ref).trim();
  return isObjectId(value) ? { _id: value } : { maintenanceId: value.toUpperCase() };
}

/** Finds a work order by ObjectId or Req ID (MNT-YYYY-NNNN). */
async function findMaintenanceByRef(ref, { populate = true } = {}) {
  let query = Maintenance.findOne(refFilter(ref));
  if (populate) query = query.populate(TECH_POPULATE);
  const job = await query;
  if (!job) throw new ApiError(404, 'MAINTENANCE_NOT_FOUND', `Maintenance ${ref} not found`);
  return job;
}

function shape(doc) {
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const id = String(o._id);
  delete o._id;
  delete o.__v;

  const tech = o.assignedTechnician;
  const techObj = tech && typeof tech === 'object' ? tech : null;
  const techId = techObj ? String(techObj._id ?? techObj.id) : tech ? String(tech) : null;

  return {
    ...o,
    id,
    assetId: o.assetId ? String(o.assetId) : null,
    assetTag: o.assetTag ?? null,
    asset: { id: o.assetId ? String(o.assetId) : null, assetTag: o.assetTag ?? null },
    technicianId: techId,
    technician: techObj
      ? {
          id: String(techObj._id ?? techObj.id),
          email: techObj.email ?? null,
          name: techObj.name ?? null,
          employeeCode: techObj.employeeCode ?? null,
        }
      : null,
  };
}

/** Best-effort asset status sync — never fail the parent operation on sync errors. */
async function syncAssetStatus(assetRef, status, req, reason) {
  try {
    await assetClient.updateInternalAssetStatus(String(assetRef), status, { requestId: req.id, reason });
  } catch (err) {
    console.warn(`[maintenance] asset status sync -> ${status} failed: ${err.message}`);
  }
}

export async function createMaintenance(req, res, next) {
  try {
    const { assetId, title, description, priority, type, scheduledFor } = req.body;
    const asset = await assetClient.getAsset(assetId, req);

    const job = await Maintenance.create({
      maintenanceId: await nextMaintenanceId(),
      assetId: asset.id ?? assetId,
      assetTag: asset.assetId ?? null,
      title,
      description,
      type: type ?? 'corrective',
      priority: priority ?? 'medium',
      status: 'requested',
      reportedBy: req.user.id,
      scheduledFor,
    });

    res.locals.activity = {
      action: 'maintenance.create',
      resource: 'maintenance',
      resourceId: job.maintenanceId,
      summary: `Created maintenance ${job.maintenanceId} for asset ${job.assetTag ?? assetId}`,
    };

    res.status(201).json({ data: shape(job) });
  } catch (err) {
    next(err);
  }
}

export async function listMaintenance(req, res, next) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const filter = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.assetId) {
      const assetRef = String(req.query.assetId).trim();
      if (isObjectId(assetRef)) {
        filter.assetId = assetRef;
      } else {
        filter.assetTag = assetRef.toUpperCase();
      }
    }

    const [items, total] = await Promise.all([
      Maintenance.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(TECH_POPULATE),
      Maintenance.countDocuments(filter),
    ]);

    res.status(200).json({
      data: items.map(shape),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMaintenance(req, res, next) {
  try {
    const job = await findMaintenanceByRef(req.params.id);
    res.status(200).json({ data: shape(job) });
  } catch (err) {
    next(err);
  }
}

export async function getMaintenanceStats(_req, res, next) {
  try {
    const [byStatusAgg, byAssetAgg, byPriorityAgg, total] = await Promise.all([
      Maintenance.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Maintenance.aggregate([{ $group: { _id: '$assetTag', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      Maintenance.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Maintenance.countDocuments({}),
    ]);

    const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id ?? 'unknown', r.count]));

    res.status(200).json({
      data: {
        statusCounts: toMap(byStatusAgg),
        byStatus: toMap(byStatusAgg),
        byPriority: toMap(byPriorityAgg),
        byAsset: byAssetAgg.map((r) => ({ assetTag: r._id, count: r.count })),
        assetFrequency: byAssetAgg.map((r) => ({ assetTag: r._id, count: r.count })),
        total,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function findTechnician(technicianId) {
  const value = String(technicianId).trim();
  const or = [];
  if (isObjectId(value)) or.push({ _id: value });
  or.push({ email: value.toLowerCase() }, { employeeCode: value.toUpperCase() });

  const tech = await Technician.findOne({ $or: or });
  if (!tech) throw new ApiError(404, 'TECHNICIAN_NOT_FOUND', `No technician found for "${technicianId}"`);
  return tech;
}

export async function assignTechnician(req, res, next) {
  try {
    const job = await findMaintenanceByRef(req.params.id, { populate: false });
    if (job.status === 'completed' || job.status === 'cancelled') {
      throw new ApiError(409, 'MAINTENANCE_CLOSED', `Cannot assign a technician to a ${job.status} work order`);
    }

    const tech = await findTechnician(req.body.technicianId);
    const fromStatus = job.status;
    job.assignedTechnician = tech._id;
    if (job.status === 'requested') job.status = 'scheduled';
    job.auditTrail.push({
      action: 'assigned',
      fromStatus,
      toStatus: job.status,
      actorId: req.user.id,
      actorRole: req.user.role,
      note: `Assigned to ${tech.email}`,
    });

    await job.save();
    await job.populate(TECH_POPULATE);

    res.locals.activity = {
      action: 'maintenance.assign',
      resource: 'maintenance',
      resourceId: job.maintenanceId,
      summary: `Assigned ${tech.email} to maintenance ${job.maintenanceId}`,
    };

    res.status(200).json({ data: shape(job) });
  } catch (err) {
    next(err);
  }
}

export async function updateMaintenanceStatus(req, res, next) {
  try {
    const job = await findMaintenanceByRef(req.params.id, { populate: false });

    const { status, notes } = req.body;
    const fromStatus = job.status;

    if (fromStatus !== status) {
      const now = new Date();
      if (status === 'in_progress' && !job.startedAt) job.startedAt = now;
      if (status === 'completed') {
        job.completedAt = now;
        if (notes) job.resolutionNotes = notes;
      }
      if (status === 'on_hold') job.onHoldReason = notes || job.onHoldReason;
      if (status === 'cancelled') job.cancelledReason = notes || job.cancelledReason;

      job.status = status;
      job.auditTrail.push({
        action: 'status_change',
        fromStatus,
        toStatus: status,
        actorId: req.user.id,
        actorRole: req.user.role,
        note: notes || undefined,
      });

      await job.save();

      // Keep the asset lifecycle in sync (best-effort).
      if (status === 'in_progress') {
        await syncAssetStatus(job.assetId, 'in_maintenance', req, `Maintenance ${job.maintenanceId} started`);
      } else if (status === 'completed' || status === 'cancelled') {
        await syncAssetStatus(job.assetId, 'in_stock', req, `Maintenance ${job.maintenanceId} ${status}`);
      }
    }

    await job.populate(TECH_POPULATE);

    res.locals.activity = {
      action: 'maintenance.status_change',
      resource: 'maintenance',
      resourceId: job.maintenanceId,
      summary: `Maintenance ${job.maintenanceId} status ${fromStatus} → ${job.status}`,
    };

    res.status(200).json({ data: shape(job) });
  } catch (err) {
    next(err);
  }
}