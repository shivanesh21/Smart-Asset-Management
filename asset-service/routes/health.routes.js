import { Router } from 'express';
import { health, ready } from '../controllers/health.controller.js';

const router = Router();

router.get('/health', health);
router.get('/health/ready', ready);

export default router;
