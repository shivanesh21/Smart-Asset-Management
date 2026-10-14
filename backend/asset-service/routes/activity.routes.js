import { Router } from 'express';
import { listActivity } from '../controllers/activity.controller.js';
import { handleValidation } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listActivityRules } from '../middleware/activity.validator.js';

const router = Router();

router.get('/activity', requireAuth, requireRole('admin'), listActivityRules, handleValidation, listActivity);

export default router;
