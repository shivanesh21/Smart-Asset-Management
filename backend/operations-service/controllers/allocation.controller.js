import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { Allocation } from '../models/allocation.model.js';
import { assetClient } from '../services/assetClient.js';
import { ApiError } from '../middleware/error.js';

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value) && /^[0-9a-fA-F]{24}$/.test(String(value));
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * The UI accepts a free-text "User ID / Email". Resolve it to a stable ObjectId
 * (a real one when possible, else a deterministic id derived from the email) and
 * keep the raw email for display.
 */
function resolveUser(rawUserId) {
  const value = String(rawUserId).trim();
  if (isObjectId(value)) {
    return { user: new mongoose.Types.ObjectId(value), userEmail: null };
  }
  if (isEmail(value)) {
    const hex = createHash('sha1').update(value.toLowerCase()).digest('hex').slice(0, 24);
    return { user: new mongoose.Types.ObjectId(hex), userEmail: value.toLowerCase() };
  }
  throw new ApiError(400, 'INVALID_USER_ID', 'userId must be a user ObjectId or an email address');
}

function shape(doc) {
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const id = String(o._id);
  delete o._id;
  delete o.__v;

  const assetId = o.asset ? String(o.asset) : null;
  const userId = o.user ? String(o.user) : null;

  return {
    ...o,
    id,
    assetId,
    assetTag: o.assetTag ?? null,
    asset: { id: assetId, assetTag: o.assetTag ?? null },
    userId: o.userEmail ?? userId,
    user: { id: userId, email: o.userEmail ?? null },
    department: o.department ?? null,
  };
}

/** Best-effort asset status sync — never fail the parent operation on sync errors. */
async function syncAssetStatus(assetRef, status, req, reason) {
  try {
    await assetClient.updateInternalAssetStatus(String(assetRef), status, { requestId: req.id, reason });
  } catch (err) {
    console.warn(`[allocations] asset status sync -> ${status} failed: ${err.message}`);
  }
}

export async function createAllocation(req, res, next) {
  try {
    const { assetId, userId, department, expectedReturnDate, purpose, notes } = req.body;

    const asset = await assetClient.getAsset(assetId, req);
    if (asset.status !== 'in_stock') {
      throw new ApiError(
        409,
        'ASSET_NOT_AVAILABLE',
        `Asset ${asset.assetId ?? assetId} is not available for allocation (current status: ${asset.status})`
      );
    }

    const { user, userEmail } = resolveUser(userId);

    await assetClient.updateInternalAssetStatus(asset.id ?? assetId, 'assigned', {
      requestId: req.id,
      reason: `Allocated to ${userId}`,
      actorId: req.user.id,
    });

    let allocation;
    try {
      allocation = await Allocation.create({
        asset: asset.id ?? assetId,
        assetTag: asset.assetId ?? null,
        user,
        userEmail,
        department: department?.trim() || asset.department || null,
        allocatedBy: req.user.id,
        status: 'active',
        conditionOnHandover: req.body.conditionOnHandover ?? 'good',
        expectedReturnDate,
        purpose,
        notes,
      });
    } catch (err) {
      await syncAssetStatus(asset.id ?? assetId, 'in_stock', req, 'Allocation failed, rolled back');
      throw err;
    }

    res.status(201).json({ data: shape(allocation) });
  } catch (err) {
    next(err);
  }
}

export async function listAllocations(req, res, next) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const filter = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.assetId) {
      filter.$or = [
        { asset: isObjectId(req.query.assetId) ? req.query.assetId : null },
        { assetTag: String(req.query.assetId).toUpperCase() },
      ];
    }

    const [items, total] = await Promise.all([
      Allocation.find(filter).sort({ allocatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
      Allocation.countDocuments(filter),
    ]);

    res.status(200).json({
      data: items.map(shape),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function myAllocations(req, res, next) {
  try {
    const filter = { $or: [{ user: req.user.id }, { userEmail: req.user.email ?? '' }] };
    const items = await Allocation.find(filter).sort({ allocatedAt: -1 });
    res.status(200).json({ data: items.map(shape) });
  } catch (err) {
    next(err);
  }
}

export async function allocationHistory(req, res, next) {
  try {
    const { assetId } = req.params;
    const filter = {
      $or: [
        { asset: isObjectId(assetId) ? assetId : null },
        { assetTag: String(assetId).toUpperCase() },
      ],
    };
    const items = await Allocation.find(filter).sort({ allocatedAt: -1 });
    res.status(200).json({ data: items.map(shape) });
  } catch (err) {
    next(err);
  }
}

export async function returnAllocation(req, res, next) {
  try {
    const allocation = await Allocation.findById(req.params.id);
    if (!allocation) throw new ApiError(404, 'ALLOCATION_NOT_FOUND', `Allocation ${req.params.id} not found`);
    if (allocation.status !== 'active') {
      throw new ApiError(409, 'ALLOCATION_NOT_ACTIVE', `Allocation is already ${allocation.status}`);
    }

    allocation.status = 'returned';
    allocation.returnedAt = new Date();
    if (req.body.notes) allocation.returnConditionNotes = req.body.notes;
    if (req.body.conditionOnReturn) allocation.conditionOnReturn = req.body.conditionOnReturn;
    await allocation.save();

    await syncAssetStatus(allocation.asset, 'in_stock', req, 'Asset returned');

    res.status(200).json({ data: shape(allocation) });
  } catch (err) {
    next(err);
  }
}

export async function transferAllocation(req, res, next) {
  try {
    const allocation = await Allocation.findById(req.params.id);
    if (!allocation) throw new ApiError(404, 'ALLOCATION_NOT_FOUND', `Allocation ${req.params.id} not found`);
    if (allocation.status !== 'active') {
      throw new ApiError(409, 'ALLOCATION_NOT_ACTIVE', `Allocation is already ${allocation.status}`);
    }

    const { user, userEmail } = resolveUser(req.body.newUserId);

    allocation.status = 'returned';
    allocation.returnedAt = new Date();
    allocation.returnConditionNotes = 'Transferred to another user';
    await allocation.save();

    const created = await Allocation.create({
      asset: allocation.asset,
      assetTag: allocation.assetTag,
      user,
      userEmail,
      department: req.body.newDepartment?.trim() || allocation.department || null,
      allocatedBy: req.user.id,
      status: 'active',
      conditionOnHandover: allocation.conditionOnHandover ?? 'good',
    });

    res.status(201).json({ data: shape(created) });
  } catch (err) {
    next(err);
  }
}