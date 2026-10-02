import mongoose from 'mongoose';
import { ALLOCATION_STATUSES } from '../constants/user.js';

const { Schema, model } = mongoose;

const allocationSchema = new Schema(
  {
    asset: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
      required: [true, 'asset is required'],
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'user is required'],
      index: true,
    },
    allocatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ALLOCATION_STATUSES,
      default: 'active',
      index: true,
    },
    allocatedAt: { type: Date, default: Date.now, required: true },
    expectedReturnDate: { type: Date },
    returnedAt: { type: Date },
    conditionOnHandover: {
      type: String,
      enum: ['new', 'good', 'fair', 'poor', 'damaged'],
      required: true,
    },
    conditionOnReturn: {
      type: String,
      enum: ['new', 'good', 'fair', 'poor', 'damaged'],
    },
    purpose: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 2000 },
    handoverNotes: { type: String, trim: true, maxlength: 2000 },
    handoverSignatureUrl: { type: String, trim: true, maxlength: 500 },
    returnConditionNotes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true, optimisticConcurrency: true }
);

allocationSchema.index(
  { asset: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
allocationSchema.index({ user: 1, status: 1 });
allocationSchema.index({ status: 1, expectedReturnDate: 1 });
allocationSchema.index({ asset: 1, allocatedAt: -1 });

allocationSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Allocation = model('Allocation', allocationSchema);
