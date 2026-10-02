import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import assetRoutes from './asset.routes.js';

const router = Router();

router.use(healthRoutes);
router.use('/api', authRoutes);
router.use('/api', assetRoutes);

export default router;