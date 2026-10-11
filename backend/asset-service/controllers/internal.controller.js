import mongoose from 'mongoose';
import { Asset } from '../models/asset.model.js';
import { canTransition, ASSET_TRANSITIONS } from '../constants/asset.js';
import { ApiError } from '../middleware/error.js';

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value) && /^[0-9a-fA-F]{24}$/.test(String(value));
}

function shape(doc) {
  const { _id, __v, ...rest } = doc;
  return { id: String(_id), ...rest };
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

/** GET /api/internal/assets/:id — service-to-service asset lookup (id or tag). */
export async function getInternalAsset(req, res, next) {
  try {
    const asset = await findLiveAsset(req.params.id);
    res.status(200).json({ data: shape(asset.toObject()) });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/internal/assets/:id/status — service-to-service status transition. */
export async function updateInternalAssetStatus(req, res, next) {
  try {
    const asset = await findLiveAsset(req.params.id);
    const { status, reason, actorId } = req.body;

    if (!status) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'status is required', [
        { field: 'status', message: 'status is required' },
      ]);
    }

    if (asset.status === status) {
      return res.status(200).json({ data: shape(asset.toObject()) });
    }

    if (!canTransition(asset.status, status)) {
      throw new ApiError(409, 'INVALID_TRANSITION', `Cannot change status from ${asset.status} to ${status}`, [
        {
          field: 'status',
          message: `Allowed next states: ${(ASSET_TRANSITIONS[asset.status] ?? []).join(', ') || 'none (terminal state)'}`,
        },
      ]);
    }

    asset.status = status;
    if (actorId) asset.updatedBy = actorId;
    if (reason) {
      asset.notes = asset.notes ? `${asset.notes}\n[status ${status}] ${reason}` : `[status ${status}] ${reason}`;
    }

    const saved = await asset.save();
    res.status(200).json({ data: shape(saved.toObject()) });
  } catch (err) {
    next(err);
  }
}
