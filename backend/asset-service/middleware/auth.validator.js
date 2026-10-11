import { body, param, query } from 'express-validator';
import { USER_ROLES } from '../constants/user.js';

const passwordRules = (field = 'password') => [
  body(field)
    .exists()
    .withMessage(`${field} is required`)
    .bail()
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage(`${field} must be 8-128 characters`)
    .matches(/[a-z]/)
    .withMessage(`${field} must contain a lowercase letter`)
    .matches(/[A-Z]/)
    .withMessage(`${field} must contain an uppercase letter`)
    .matches(/\d/)
    .withMessage(`${field} must contain a number`),
];

export const registerRules = [
  body('name')
    .trim()
    .exists()
    .withMessage('name is required')
    .bail()
    .isLength({ min: 2, max: 120 })
    .withMessage('name must be 2-120 characters'),
  body('email')
    .trim()
    .toLowerCase()
    .exists()
    .withMessage('email is required')
    .bail()
    .isEmail()
    .withMessage('email is not valid'),
  ...passwordRules(),
  body('department').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
  body('phone').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
  body('employeeCode').optional({ values: 'falsy' }).trim().isLength({ max: 32 }),
  body('jobTitle').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
  body('site').optional({ values: 'falsy' }).trim().isLength({ max: 80 }),
];

export const adminCreateUserRules = [
  ...registerRules,
  body('role')
    .exists()
    .withMessage('role is required')
    .bail()
    .isIn(USER_ROLES)
    .withMessage(`role must be one of: ${USER_ROLES.join(', ')}`),
];

export const loginRules = [
  body('email')
    .trim()
    .toLowerCase()
    .exists()
    .withMessage('email is required')
    .bail()
    .isEmail()
    .withMessage('email is not valid'),
  body('password')
    .exists()
    .withMessage('password is required')
    .bail()
    .isString()
    .isLength({ min: 1 })
    .withMessage('password is required'),
];

export const listUsersRules = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be an integer >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('role').optional().isIn(USER_ROLES).withMessage(`role must be one of: ${USER_ROLES.join(', ')}`),
  query('isActive').optional().isBoolean().withMessage('isActive must be true or false'),
];

export const userIdRules = [
  param('id').custom((v) => /^[0-9a-fA-F]{24}$/.test(v)).withMessage('id must be a 24-character hex ObjectId'),
];