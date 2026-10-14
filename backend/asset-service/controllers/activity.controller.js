import { Activity } from '../models/activity.model.js';
import { recordActivity } from '../services/activity.service.js';

function shape(doc) {
  const { _id, __v, ...rest } = doc;
  return { id: String(_id), ...rest };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/activity (admin only)
 * Query: actorId, actorEmail, action, resource, source, search, from, to, page, limit
 */
export async function listActivity(req, res, next) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const filter = {};

    for (const field of ['actorId', 'action', 'resource', 'source']) {
      if (req.query[field]) filter[field] = req.query[field];
    }
    if (req.query.actorEmail) {
      filter.actorEmail = String(req.query.actorEmail).toLowerCase();
    }

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    if (req.query.search) {
      const rx = new RegExp(escapeRegex(req.query.search), 'i');
      filter.$or = [{ summary: rx }, { actorEmail: rx }, { action: rx }, { resourceId: rx }];
    }

    const [items, total] = await Promise.all([
      Activity.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Activity.countDocuments(filter),
    ]);

    res.status(200).json({
      data: items.map(shape),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/internal/activity (service token)
 * Lets the operations-service contribute to the unified feed.
 */
export async function recordInternalActivity(req, res, next) {
  try {
    const doc = await recordActivity({ ...req.body, source: req.body?.source ?? 'operations-service' });
    res.status(201).json({ data: doc ? { id: String(doc._id) } : null });
  } catch (err) {
    next(err);
  }
}
