import mongoose from 'mongoose';
import { ALLOCATION_STATUSES, ALLOCATION_CONDITIONS } from '../constants/allocation.js';

const { Schema, model } = mongoose;

// `asset_db.Allocations` is owned by asset-service, which is the only service that writes
// allocations. operations-service keeps a local definition so it can read allocation state
// when working on maintenance, but must never insert or mutate an allocation here.
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
      enum: ALLOCATION_CONDITIONS,
      required: [true, 'conditionOnHandover is required'],
    },
    conditionOnReturn: {
      type: String,
      enum: ALLOCATION_CONDITIONS,
    },
    purpose: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 2000 },
    handoverNotes: { type: String, trim: true, maxlength: 2000 },
    handoverSignatureUrl: { type: String, trim: true, maxlength: 500 },
    returnConditionNotes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true, optimisticConcurrency: true }
);

// `index: true` on `asset` already produces `asset_1`, so this index needs an explicit name.
// Left unnamed it would also be called `asset_1` and MongoDB would refuse the second one,
// silently dropping the one-active-allocation-per-asset guarantee.
allocationSchema.index(
  { asset: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'one_active_allocation_per_asset',
  }
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