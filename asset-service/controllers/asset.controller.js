import mongoose from 'mongoose';
import { Asset } from '../models/asset.model.js';
import { nextAssetId } from '../models/counter.model.js';
import { canTransition, ASSET_TRANSITIONS } from '../constants/asset.js';
import { ApiError } from '../middleware/error.js';

const SORTABLE = {
  assetId: 1,
  name: 1,
  category: 1,
  status: 1,
  department: 1,
  condition: 1,
  purchaseDate: 1,
  createdAt: 1,
};

function parseSort(sort) {
  if (!sort) {
    return { createdAt: -1, _id: 1 };
  }
  return sort.split(',').reduce((acc, token) => {
    const desc = token.startsWith('-');
    const field = desc ? token.slice(1) : token;
    acc[field] = desc ? -1 : 1;
    return acc;
  }, {});
}

export async function createAsset(req, res, next) {
  try {
    const asset = await Asset.create({
      ...req.body,
      assetId: await nextAssetId(),
      createdBy: req.user?.id ?? null,
    });

    res.status(201).json({ data: asset.toJSON() });
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return next(
        new ApiError(
          400,
          'VALIDATION_ERROR',
          'Asset failed validation',
          Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
        )
      );
    }
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern ?? {})[0] ?? 'field';
      const code = field === 'serialNumber' ? 'SERIAL_NUMBER_EXISTS' : 'DUPLICATE_KEY';
      return next(new ApiError(409, code, `An asset with this ${field} already exists`));
    }
    return next(err);
  }
}

export async function listAssets(req, res, next) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const filter = { deletedAt: null };

    for (const field of ['status', 'category', 'condition', 'department', 'serialNumber']) {
      if (req.query[field]) {
        filter[field] = req.query[field];
      }
    }

    const term = req.query.search ?? req.query.q;
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      filter.$or = [{ name: rx }, { assetId: rx }, { serialNumber: rx }, { notes: rx }];
    }

    const sort = parseSort(req.query.sort);
    const [items, total] = await Promise.all([
      Asset.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Asset.countDocuments(filter),
    ]);

    res.status(200).json({
      data: items.map(shape),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAsset(req, res, next) {
  try {
    const { id } = req.params;
    const asset = await Asset.findOne({
      $or: [{ _id: isObjectId(id) ? id : null }, { assetId: id.toUpperCase() }],
      deletedAt: null,
    }).lean();

    if (!asset) {
      throw new ApiError(404, 'ASSET_NOT_FOUND', `Asset ${id} not found`);
    }

    res.status(200).json({ data: shape(asset) });
  } catch (err) {
    next(err);
  }
}

export async function replaceAsset(req, res, next) {
  try {
    const asset = await findLiveAsset(req.params.id);
    applyUpdate(asset, req.body, { replace: true });
    asset.updatedBy = req.user?.id ?? asset.updatedBy;

    const saved = await asset.save();
    res.status(200).json({ data: saved.toJSON() });
  } catch (err) {
    handleWriteError(err, res, next);
  }
}

export async function updateAsset(req, res, next) {
  try {
    const asset = await findLiveAsset(req.params.id);
    applyUpdate(asset, req.body, { replace: false });
    asset.updatedBy = req.user?.id ?? asset.updatedBy;

    const saved = await asset.save();
    res.status(200).json({ data: saved.toJSON() });
  } catch (err) {
    handleWriteError(err, res, next);
  }
}

export async function updateAssetStatus(req, res, next) {
  try {
    const asset = await findLiveAsset(req.params.id);
    const { status, reason } = req.body;

    if (asset.status === status) {
      return res.status(200).json({ data: asset.toJSON() });
    }

    if (!canTransition(asset.status, status)) {
      throw new ApiError(
        409,
        'INVALID_TRANSITION',
        `Cannot change status from ${asset.status} to ${status}`,
        [
          {
            field: 'status',
            message: `Allowed next states: ${(ASSET_TRANSITIONS[asset.status] ?? []).join(', ') || 'none (terminal state)'}`,
          },
        ]
      );
    }

    asset.status = status;
    asset.updatedBy = req.user?.id ?? asset.updatedBy;
    if (reason) {
      asset.notes = asset.notes ? `${asset.notes}\n[status ${status}] ${reason}` : `[status ${status}] ${reason}`;
    }

    const saved = await asset.save();
    res.status(200).json({ data: saved.toJSON() });
  } catch (err) {
    handleWriteError(err, res, next);
  }
}

export async function deleteAsset(req, res, next) {
  try {
    const asset = await findLiveAsset(req.params.id);

    if (asset.status === 'assigned' || asset.assignedTo) {
      throw new ApiError(
        409,
        'ASSET_HAS_ACTIVE_ALLOCATION',
        'An allocated asset cannot be deleted. Return or cancel the allocation first.'
      );
    }

    if (asset.status === 'in_maintenance') {
      throw new ApiError(
        409,
        'ASSET_IN_MAINTENANCE',
        'An asset under maintenance cannot be deleted. Complete or cancel the work order first.'
      );
    }

    asset.deletedAt = new Date();
    asset.updatedBy = req.user?.id ?? asset.updatedBy;
    await asset.save();

    res.status(204).send();
  } catch (err) {
    handleWriteError(err, res, next);
  }
}

async function findLiveAsset(id) {
  const asset = await Asset.findOne({
    $or: [{ _id: isObjectId(id) ? id : null }, { assetId: String(id).toUpperCase() }],
    deletedAt: null,
  });

  if (!asset) {
    throw new ApiError(404, 'ASSET_NOT_FOUND', `Asset ${id} not found`);
  }

  return asset;
}

const IMMUTABLE_FIELDS = ['assetId', 'createdAt', 'updatedAt', 'deletedAt', '_id', '__v'];

function applyUpdate(asset, body, { replace }) {
  for (const key of IMMUTABLE_FIELDS) {
    delete body[key];
  }
  delete body.status;

  if (replace) {
    for (const path of Object.keys(asset.schema.paths)) {
      if (!IMMUTABLE_FIELDS.includes(path) && !body.hasOwnProperty(path) && !asset.schema.paths[path].default) {
        asset.set(path, undefined);
      }
    }
  }

  asset.set(body);
}

function handleWriteError(err, res, next) {
  if (err instanceof mongoose.Error.ValidationError) {
    return next(
      new ApiError(
        400,
        'VALIDATION_ERROR',
        'Asset failed validation',
        Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
      )
    );
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern ?? {})[0] ?? 'field';
    const code = field === 'serialNumber' ? 'SERIAL_NUMBER_EXISTS' : 'DUPLICATE_KEY';
    return next(new ApiError(409, code, `An asset with this ${field} already exists`));
  }

  return next(err);
}

export async function getAssetSummary(_req, res, next) {
  try {
    const [byStatus, byCategory, byDepartment, totals] = await Promise.all([
      Asset.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Asset.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Asset.aggregate([{ $group: { _id: '$department', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      Asset.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalValue: { $sum: '$purchaseCost' },
            averageCost: { $avg: '$purchaseCost' },
          },
        },
      ]),
    ]);

    const shape = (rows) => Object.fromEntries(rows.map((r) => [r._id ?? 'unassigned', r.count]));
    const agg = totals[0] ?? { total: 0, totalValue: 0, averageCost: 0 };

    res.status(200).json({
      data: {
        byStatus: shape(byStatus),
        byCategory: shape(byCategory),
        byDepartment: shape(byDepartment),
        totalAssets: agg.total,
        totalValue: { amount: agg.totalValue ?? 0, currency: 'INR' },
        averageCost: agg.averageCost ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value) && /^[0-9a-fA-F]{24}$/.test(value);
}

function shape(doc) {
  const { _id, __v, ...rest } = doc;
  return { id: String(_id), ...rest };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
