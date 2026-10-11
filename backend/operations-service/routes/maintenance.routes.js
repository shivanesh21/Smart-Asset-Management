import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { handleValidation } from '../middleware/validate.js';
import {
  createMaintenance,
  listMaintenance,
  getMaintenance,
  getMaintenanceStats,
  assignTechnician,
  updateMaintenanceStatus,
} from '../controllers/maintenance.controller.js';
import {
  createMaintenanceRules,
  listMaintenanceRules,
  maintenanceIdRules,
  assignTechnicianRules,
  updateMaintenanceStatusRules,
} from '../middleware/maintenance.validator.js';

const router = Router();

const canReport = requireRole('admin', 'staff');
const canUpdate = requireRole('admin', 'staff', 'technician');

router.post(
  '/maintenance',
  requireAuth,
  canReport,
  createMaintenanceRules,
  handleValidation,
  createMaintenance
);
router.get('/maintenance', requireAuth, listMaintenanceRules, handleValidation, listMaintenance);
router.get('/maintenance/stats', requireAuth, getMaintenanceStats);
router.get('/maintenance/:id', requireAuth, maintenanceIdRules, handleValidation, getMaintenance);
router.post(
  '/maintenance/:id/assign',
  requireAuth,
  requireRole('admin'),
  maintenanceIdRules,
  assignTechnicianRules,
  handleValidation,
  assignTechnician
);
router.patch(
  '/maintenance/:id/status',
  requireAuth,
  canUpdate,
  maintenanceIdRules,
  updateMaintenanceStatusRules,
  handleValidation,
  updateMaintenanceStatus
);

export default router;