import { body, param, query } from 'express-validator';
import { ALLOCATION_STATUSES, ALLOCATION_CONDITIONS } from '../constants/allocation.js';

const isObjectId = /^[0-9a-fA-F]{24}$/;
const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createAllocationRules = [
  body('assetId')
    .trim()
    .notEmpty()
    .withMessage('assetId is required')
    .bail()
    .custom((v) => isObjectId.test(v))
    .withMessage('assetId must be a 24-character hex ObjectId'),
  body('userId')
    .trim()
    .notEmpty()
    .withMessage('userId (id or email) is required')
    .bail()
    .custom((v) => isObjectId.test(v) || isEmail.test(v))
    .withMessage('userId must be a 24-character hex ObjectId or an email address'),
  body('department').optional().trim().isLength({ max: 80 }).withMessage('department must be at most 80 characters'),
  body('expectedReturnDate').optional({ values: 'falsy' }).isISO8601().withMessage('expectedReturnDate must be an ISO 8601 date'),
  body('purpose').optional().trim().isLength({ max: 500 }),
  body('notes').optional().trim().isLength({ max: 2000 }),
];

export const listAllocationsRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be an integer >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be an integer between 1 and 100'),
  query('status').optional().isIn(ALLOCATION_STATUSES).withMessage(`status must be one of: ${ALLOCATION_STATUSES.join(', ')}`),
];

export const allocationIdRules = [
  param('id').custom((v) => isObjectId.test(v)).withMessage('id must be a 24-character hex ObjectId'),
];

export const assetIdOrTagRules = [
  param('assetId').trim().notEmpty().withMessage('assetId is required'),
];

export const returnAllocationRules = [
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }),
  body('conditionOnReturn').optional().isIn(ALLOCATION_CONDITIONS).withMessage(`conditionOnReturn must be one of: ${ALLOCATION_CONDITIONS.join(', ')}`),
];

export const transferAllocationRules = [
  body('newUserId')
    .trim()
    .notEmpty()
    .withMessage('newUserId (id or email) is required')
    .bail()
    .custom((v) => isObjectId.test(v) || isEmail.test(v))
    .withMessage('newUserId must be a 24-character hex ObjectId or an email address'),
  body('newDepartment').optional().trim().isLength({ max: 80 }).withMessage('newDepartment must be at most 80 characters'),
];