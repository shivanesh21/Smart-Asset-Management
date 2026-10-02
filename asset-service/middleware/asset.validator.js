import { body, param, query } from 'express-validator';
import { ASSET_STATUSES, ASSET_CATEGORIES, ASSET_CONDITIONS, LOCATION_TYPES } from '../constants/asset.js';

const isObjectId = /^[0-9a-fA-F]{24}$/;

export const createAssetRules = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('name is required')
    .bail()
    .isLength({ min: 2, max: 160 })
    .withMessage('name must be 2-160 characters'),
  body('category')
    .notEmpty()
    .withMessage('category is required')
    .bail()
    .isIn(ASSET_CATEGORIES)
    .withMessage(`category must be one of: ${ASSET_CATEGORIES.join(', ')}`),
  body('serialNumber')
    .optional()
    .trim()
    .toUpperCase()
    .isLength({ max: 64 })
    .withMessage('serialNumber must be at most 64 characters'),
  body('department').optional().trim().isLength({ max: 80 }).withMessage('department must be at most 80 characters'),
  body('condition').optional().isIn(ASSET_CONDITIONS).withMessage(`condition must be one of: ${ASSET_CONDITIONS.join(', ')}`),
  body('status').optional().isIn(ASSET_STATUSES).withMessage(`status must be one of: ${ASSET_STATUSES.join(', ')}`),
  body('purchaseDate').optional({ values: 'falsy' }).isISO8601().withMessage('purchaseDate must be an ISO 8601 date'),
  body('purchaseCost').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('purchaseCost must be a number >= 0').toFloat(),
  body('currency').optional().trim().toUpperCase().isLength({ min: 3, max: 3 }).withMessage('currency must be a 3-letter code'),
  body('manufacturer').optional().trim().isLength({ max: 80 }).withMessage('manufacturer must be at most 80 characters'),
  body('model').optional().trim().isLength({ max: 80 }).withMessage('model must be at most 80 characters'),
  body('vendor').optional().trim().isLength({ max: 120 }).withMessage('vendor must be at most 120 characters'),
  body('warrantyEndDate').optional({ values: 'falsy' }).isISO8601().withMessage('warrantyEndDate must be an ISO 8601 date'),
  body('location.type').optional().isIn(LOCATION_TYPES).withMessage(`location.type must be one of: ${LOCATION_TYPES.join(', ')}`),
  body('location.label').optional().trim().isLength({ max: 120 }).withMessage('location.label must be at most 120 characters'),
  body('notes').optional().trim().isLength({ max: 2000 }).withMessage('notes must be at most 2000 characters'),
];

export const listAssetsRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be an integer >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be an integer between 1 and 100'),
  query('status').optional().isIn(ASSET_STATUSES).withMessage(`status must be one of: ${ASSET_STATUSES.join(', ')}`),
  query('category').optional().isIn(ASSET_CATEGORIES).withMessage(`category must be one of: ${ASSET_CATEGORIES.join(', ')}`),
  query('condition').optional().isIn(ASSET_CONDITIONS).withMessage(`condition must be one of: ${ASSET_CONDITIONS.join(', ')}`),
  query('department').optional().trim().isLength({ max: 80 }).withMessage('department must be at most 80 characters'),
  query('serialNumber').optional().trim().toUpperCase(),
  query('q').optional().trim().isLength({ max: 120 }).withMessage('q must be at most 120 characters'),
  query('search').optional().trim().isLength({ max: 120 }).withMessage('search must be at most 120 characters'),
  query('sort')
    .optional()
    .matches(/^-?(assetId|name|category|status|department|condition|purchaseDate|createdAt)(,-?(assetId|name|category|status|department|condition|purchaseDate|createdAt))*$/)
    .withMessage('sort must be a comma-separated list of allowed fields, prefix - for descending'),
];

export const assetIdParamRules = [
  param('id').custom((v) => isObjectId.test(v)).withMessage('id must be a 24-character hex ObjectId'),
];

export const assetIdOrTagRules = [
  param('id').custom((v) => isObjectId.test(v) || /^AST-\d{4,}$/.test(v.toUpperCase())).withMessage('id must be a 24-character hex ObjectId or an assetId like AST-1001'),
];

const optionalText = (field, max) =>
  body(field).optional({ values: 'falsy' }).trim().isLength({ max }).withMessage(`${field} must be at most ${max} characters`);

const coreRules = ({ requireCore }) => {
  const name = body('name');
  const category = body('category');
  const categoryMessage = `category must be one of: ${ASSET_CATEGORIES.join(', ')}`;

  if (requireCore) {
    name
      .exists()
      .withMessage('name is required for PUT')
      .bail()
      .trim()
      .notEmpty()
      .withMessage('name is required')
      .bail()
      .isLength({ min: 2, max: 160 })
      .withMessage('name must be 2-160 characters');
    category
      .exists()
      .withMessage('category is required for PUT')
      .bail()
      .isIn(ASSET_CATEGORIES)
      .withMessage(categoryMessage);
  } else {
    name.optional().trim().isLength({ min: 2, max: 160 }).withMessage('name must be 2-160 characters');
    category.optional().isIn(ASSET_CATEGORIES).withMessage(categoryMessage);
  }

  return [name, category];
};

const updateFields = (options) => [
  ...coreRules(options),
  body('serialNumber')
    .optional({ values: 'falsy' })
    .trim()
    .toUpperCase()
    .isLength({ max: 64 })
    .withMessage('serialNumber must be at most 64 characters'),
  optionalText('department', 80),
  body('condition').optional().isIn(ASSET_CONDITIONS).withMessage(`condition must be one of: ${ASSET_CONDITIONS.join(', ')}`),
  body('purchaseDate').optional({ values: 'falsy' }).isISO8601().withMessage('purchaseDate must be an ISO 8601 date'),
  body('purchaseCost')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 })
    .withMessage('purchaseCost must be a number >= 0')
    .toFloat(),
  body('currency')
    .optional({ values: 'falsy' })
    .trim()
    .toUpperCase()
    .isLength({ min: 3, max: 3 })
    .withMessage('currency must be a 3-letter code'),
  optionalText('manufacturer', 80),
  optionalText('model', 80),
  optionalText('vendor', 120),
  body('warrantyEndDate').optional({ values: 'falsy' }).isISO8601().withMessage('warrantyEndDate must be an ISO 8601 date'),
  body('location.label').optional({ values: 'falsy' }).trim().isLength({ max: 120 }),
  body('location.type')
    .optional({ values: 'falsy' })
    .isIn(LOCATION_TYPES)
    .withMessage(`location.type must be one of: ${LOCATION_TYPES.join(', ')}`),
  optionalText('notes', 2000),
];

export const replaceAssetRules = updateFields({ requireCore: true });

export const updateAssetRules = updateFields({ requireCore: false });

export const updateStatusRules = [
  body('status')
    .exists()
    .withMessage('status is required')
    .bail()
    .isIn(ASSET_STATUSES)
    .withMessage(`status must be one of: ${ASSET_STATUSES.join(', ')}`),
  body('reason').optional({ values: 'falsy' }).trim().isLength({ max: 500 }),
];
