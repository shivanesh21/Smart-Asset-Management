import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import assetRoutes from './asset.routes.js';
import internalRoutes from './internal.routes.js';

const router = Router();

router.use(healthRoutes);
router.use('/api', authRoutes);
router.use('/api', assetRoutes);
router.use('/api', internalRoutes);

export default router;