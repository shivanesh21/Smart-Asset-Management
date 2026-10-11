import { User } from '../models/user.model.js';
import { ApiError } from '../middleware/error.js';
import {
  signToken,
  tokenLifetimeSeconds,
  registerFailedLogin,
  registerSuccessfulLogin,
} from '../middleware/auth.js';

const GENERIC_CREDENTIALS_ERROR = 'Invalid email or password';

export async function register(req, res, next) {
  try {
    const { name, email, password, department, phone, employeeCode, jobTitle, site } = req.body;

    const existing = await User.findOne({ email: String(email).toLowerCase() });
    if (existing) {
      throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'A user with that email already exists');
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await User.hashPassword(password),
      role: 'staff',
      department,
      phone,
      employeeCode,
      jobTitle,
      site,
    });

    res.status(201).json({ data: user.toJSON() });
  } catch (err) {
    if (err.code === 11000) {
      return next(new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'A user with that email already exists'));
    }
    return next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+passwordHash');

    if (!user) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', GENERIC_CREDENTIALS_ERROR);
    }

    if (user.isLocked()) {
      throw new ApiError(
        429,
        'ACCOUNT_LOCKED',
        `Account is locked. Try again after ${user.lockedUntil.toISOString()}`
      );
    }

    const matches = await user.verifyPassword(password);

    if (!matches) {
      await registerFailedLogin(user);
      throw new ApiError(401, 'INVALID_CREDENTIALS', GENERIC_CREDENTIALS_ERROR);
    }

    if (!user.isActive) {
      throw new ApiError(403, 'ACCOUNT_INACTIVE', 'Your account is inactive. Contact an admin.');
    }

    await registerSuccessfulLogin(user);

    const accessToken = signToken(user);

    res.status(200).json({
      accessToken,
      tokenType: 'Bearer',
      expiresIn: tokenLifetimeSeconds(accessToken),
      user: user.toJSON(),
    });
  } catch (err) {
    return next(err);
  }
}

export async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    res.status(200).json({ data: user.toJSON() });
  } catch (err) {
    next(err);
  }
}

export async function createUserAsAdmin(req, res, next) {
  try {
    const { name, email, password, role, department, phone, employeeCode, jobTitle, site } = req.body;

    const existing = await User.findOne({ email: String(email).toLowerCase() });
    if (existing) {
      throw new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'A user with that email already exists');
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await User.hashPassword(password),
      role,
      department,
      phone,
      employeeCode,
      jobTitle,
      site,
      mustChangePassword: true,
    });

    res.status(201).json({ data: user.toJSON() });
  } catch (err) {
    if (err.code === 11000) {
      return next(new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'A user with that email already exists'));
    }
    return next(err);
  }
}

export async function listUsers(req, res, next) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const filter = {};

    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.isActive !== undefined) {
      filter.isActive = req.query.isActive === 'true';
    }

    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      data: users.map((u) => {
        const { _id, __v, ...rest } = u;
        return { id: String(_id), ...rest };
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    });
  } catch (err) {
    next(err);
  }
}