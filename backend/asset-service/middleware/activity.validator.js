import { query } from 'express-validator';

export const listActivityRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be an integer >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('actorId').optional().isMongoId().withMessage('actorId must be a Mongo ObjectId'),
  query('actorEmail').optional().trim().isLength({ max: 160 }),
  query('action').optional().trim().isLength({ max: 80 }),
  query('resource').optional().trim().isLength({ max: 40 }),
  query('source').optional().trim().isLength({ max: 40 }),
  query('search').optional().trim().isLength({ max: 120 }),
  query('from').optional({ values: 'falsy' }).isISO8601().withMessage('from must be an ISO 8601 date'),
  query('to').optional({ values: 'falsy' }).isISO8601().withMessage('to must be an ISO 8601 date'),
];
