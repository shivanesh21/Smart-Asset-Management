import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { USER_ROLES } from '../constants/user.js';

const { Schema, model } = mongoose;

export const BCRYPT_ROUNDS = 10;
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'email is not valid'],
    },
    passwordHash: {
      type: String,
      required: [true, 'passwordHash is required'],
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'staff',
      index: true,
    },
    department: { type: String, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 20 },
    employeeCode: { type: String, trim: true, unique: true, sparse: true },
    jobTitle: { type: String, trim: true, maxlength: 80 },
    site: { type: String, trim: true, maxlength: 80 },
    isActive: { type: Boolean, default: true, index: true },
    lastLoginAt: { type: Date, default: null },
    mustChangePassword: { type: Boolean, default: false },
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ name: 'text', email: 'text', employeeCode: 'text' });

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.isLocked = function isLocked() {
  return Boolean(this.lockedUntil && this.lockedUntil.getTime() > Date.now());
};

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.passwordHash;
    return ret;
  },
});

userSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
};

export const User = model('User', userSchema);