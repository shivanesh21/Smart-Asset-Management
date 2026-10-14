import { body, param, query } from 'express-validator';
import { MAINTENANCE_TYPES, MAINTENANCE_PRIORITIES, MAINTENANCE_STATUSES } from '../constants/maintenance.js';

const isObjectId = /^[0-9a-fA-F]{24}$/;
const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const createMaintenanceRules = [
  body('assetId')
    .trim()
    .notEmpty()
    .withMessage('assetId is required')
    .bail()
    .custom((v) => isObjectId.test(v))
    .withMessage('assetId must be a 24-character hex ObjectId'),
  body('title')
    .trim()
    .notEmpty()
    .withMessage('title is required')
    .bail()
    .isLength({ min: 3, max: 160 })
    .withMessage('title must be 3-160 characters'),
  body('description').optional().trim().isLength({ max: 4000 }).withMessage('description must be at most 4000 characters'),
  body('type').optional().isIn(MAINTENANCE_TYPES).withMessage(`type must be one of: ${MAINTENANCE_TYPES.join(', ')}`),
  body('priority').optional().isIn(MAINTENANCE_PRIORITIES).withMessage(`priority must be one of: ${MAINTENANCE_PRIORITIES.join(', ')}`),
  body('scheduledFor').optional({ values: 'falsy' }).isISO8601().withMessage('scheduledFor must be an ISO 8601 date'),
];

export const listMaintenanceRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be an integer >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be an integer between 1 and 100'),
  query('status').optional().isIn(MAINTENANCE_STATUSES).withMessage(`status must be one of: ${MAINTENANCE_STATUSES.join(', ')}`),
  query('priority').optional().isIn(MAINTENANCE_PRIORITIES).withMessage(`priority must be one of: ${MAINTENANCE_PRIORITIES.join(', ')}`),
  query('assetId')
    .optional({ values: 'falsy' })
    .custom((v) => /^[0-9a-fA-F]{24}$/.test(v) || /^AST-\d{4,}$/i.test(String(v)))
    .withMessage('assetId must be a 24-character hex ObjectId or an AST-xxxx tag'),
];

export const maintenanceIdRules = [
  param('id')
    .custom((v) => isObjectId.test(v) || /^MNT-\d{4}-\d{4,}$/i.test(String(v)))
    .withMessage('id must be a 24-character hex ObjectId or a maintenance ID like MNT-2026-0001'),
];

export const assignTechnicianRules = [
  body('technicianId')
    .trim()
    .notEmpty()
    .withMessage('technicianId (id, email or employee code) is required')
    .bail()
    .custom((v) => isObjectId.test(v) || isEmail.test(v) || /^[A-Z0-9-]{2,32}$/.test(String(v).toUpperCase()))
    .withMessage('technicianId must be a 24-character hex ObjectId, an email, or an employee code'),
];

export const updateMaintenanceStatusRules = [
  body('status')
    .notEmpty()
    .withMessage('status is required')
    .bail()
    .isIn(MAINTENANCE_STATUSES)
    .withMessage(`status must be one of: ${MAINTENANCE_STATUSES.join(', ')}`),
  body('notes').optional({ values: 'falsy' }).trim().isLength({ max: 4000 }).withMessage('notes must be at most 4000 characters'),
];