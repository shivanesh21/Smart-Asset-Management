import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import assetRoutes from './asset.routes.js';
import activityRoutes from './activity.routes.js';
import internalRoutes from './internal.routes.js';
import { activityLogger } from '../middleware/activityLog.js';

const router = Router();

router.use(healthRoutes);
// Records authenticated mutating requests (/api/*) into the activity feed.
router.use('/api', activityLogger);
router.use('/api', authRoutes);
router.use('/api', assetRoutes);
router.use('/api', activityRoutes);
router.use('/api', internalRoutes);

export default router;