import { Router } from 'express';
import { register, login, me, createUserAsAdmin, listUsers } from '../controllers/auth.controller.js';
import { handleValidation } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  registerRules,
  loginRules,
  listUsersRules,
  adminCreateUserRules,
} from '../middleware/auth.validator.js';

const router = Router();

router.post('/auth/register', registerRules, handleValidation, register);
router.post('/auth/login', loginRules, handleValidation, login);
router.get('/auth/me', requireAuth, me);
router.get('/users', requireAuth, requireRole('admin'), listUsersRules, handleValidation, listUsers);
router.post('/users', requireAuth, requireRole('admin'), adminCreateUserRules, handleValidation, createUserAsAdmin);

export default router;