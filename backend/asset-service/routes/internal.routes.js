import { Router } from 'express';
import { requireServiceToken } from '../middleware/serviceAuth.js';
import { getInternalAsset, updateInternalAssetStatus } from '../controllers/internal.controller.js';
import { recordInternalActivity } from '../controllers/activity.controller.js';

const router = Router();

router.use('/internal', requireServiceToken);
router.get('/internal/assets/:id', getInternalAsset);
router.patch('/internal/assets/:id/status', updateInternalAssetStatus);
router.post('/internal/activity', recordInternalActivity);

export default router;
