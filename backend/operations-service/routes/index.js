import { Router } from 'express';
import healthRoutes from './health.routes.js';
import allocationRoutes from './allocation.routes.js';
import maintenanceRoutes from './maintenance.routes.js';

const router = Router();

router.use(healthRoutes);
router.use('/api', allocationRoutes);
router.use('/api', maintenanceRoutes);

export default router;