import { Router } from 'express';
import healthRoutes from './health.routes.js';
import allocationRoutes from './allocation.routes.js';
import maintenanceRoutes from './maintenance.routes.js';
import { activityLogger } from '../middleware/activityLog.js';

const router = Router();

router.use(healthRoutes);
// Mirror authenticated mutations into the asset-service activity feed.
router.use('/api', activityLogger);
router.use('/api', allocationRoutes);
router.use('/api', maintenanceRoutes);

export default router;