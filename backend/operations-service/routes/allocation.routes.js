import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { handleValidation } from '../middleware/validate.js';
import {
  createAllocation,
  listAllocations,
  myAllocations,
  allocationHistory,
  returnAllocation,
  transferAllocation,
} from '../controllers/allocation.controller.js';
import {
  createAllocationRules,
  listAllocationsRules,
  allocationIdRules,
  assetIdOrTagRules,
  returnAllocationRules,
  transferAllocationRules,
} from '../middleware/allocation.validator.js';

const router = Router();

const canAllocate = requireRole('admin', 'staff');

router.post(
  '/allocations',
  requireAuth,
  canAllocate,
  createAllocationRules,
  handleValidation,
  createAllocation
);
router.get('/allocations', requireAuth, listAllocationsRules, handleValidation, listAllocations);
router.get('/allocations/my', requireAuth, myAllocations);
router.get('/allocations/asset/:assetId', requireAuth, assetIdOrTagRules, handleValidation, allocationHistory);
router.post(
  '/allocations/:id/return',
  requireAuth,
  canAllocate,
  allocationIdRules,
  returnAllocationRules,
  handleValidation,
  returnAllocation
);
router.post(
  '/allocations/:id/transfer',
  requireAuth,
  canAllocate,
  allocationIdRules,
  transferAllocationRules,
  handleValidation,
  transferAllocation
);

export default router;