import { Router } from 'express';
import {
  createAsset,
  listAssets,
  getAsset,
  getAssetSummary,
  replaceAsset,
  updateAsset,
  updateAssetStatus,
  deleteAsset,
} from '../controllers/asset.controller.js';
import { handleValidation } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createAssetRules,
  listAssetsRules,
  replaceAssetRules,
  updateAssetRules,
  updateStatusRules,
  assetIdOrTagRules,
} from '../middleware/asset.validator.js';

const router = Router();

const canWrite = requireRole('admin', 'staff');

router.get('/assets/summary', requireAuth, getAssetSummary);
router.post('/assets', requireAuth, canWrite, createAssetRules, handleValidation, createAsset);
router.get('/assets', requireAuth, listAssetsRules, handleValidation, listAssets);
router.get('/assets/:id', requireAuth, assetIdOrTagRules, handleValidation, getAsset);
router.put('/assets/:id', requireAuth, canWrite, assetIdOrTagRules, replaceAssetRules, handleValidation, replaceAsset);
router.patch('/assets/:id', requireAuth, canWrite, assetIdOrTagRules, updateAssetRules, handleValidation, updateAsset);
router.patch(
  '/assets/:id/status',
  requireAuth,
  canWrite,
  assetIdOrTagRules,
  updateStatusRules,
  handleValidation,
  updateAssetStatus
);
router.delete('/assets/:id', requireAuth, canWrite, assetIdOrTagRules, handleValidation, deleteAsset);

export default router;