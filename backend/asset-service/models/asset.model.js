import mongoose from 'mongoose';
import { ASSET_STATUSES, ASSET_CATEGORIES, ASSET_CONDITIONS, LOCATION_TYPES } from '../constants/asset.js';

const { Schema, model } = mongoose;

const locationSchema = new Schema(
  {
    label: { type: String, trim: true, maxlength: 120 },
    type: { type: String, enum: LOCATION_TYPES, default: 'office' },
    site: { type: String, trim: true, maxlength: 80 },
    building: { type: String, trim: true, maxlength: 80 },
    floor: { type: String, trim: true, maxlength: 40 },
    room: { type: String, trim: true, maxlength: 40 },
    coordinates: { lat: Number, lon: Number },
  },
  { _id: false }
);

const assetSchema = new Schema(
  {
    assetId: {
      type: String,
      required: [true, 'assetId is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^AST-\d{4,}$/, 'assetId must look like AST-1001'],
    },
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    category: {
      type: String,
      enum: ASSET_CATEGORIES,
      required: [true, 'category is required'],
      index: true,
    },
    serialNumber: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 64,
      unique: true,
      sparse: true,
    },
    department: { type: String, trim: true, maxlength: 80, index: true },
    condition: {
      type: String,
      enum: ASSET_CONDITIONS,
      default: 'new',
    },
    status: {
      type: String,
      enum: ASSET_STATUSES,
      default: 'draft',
      index: true,
    },
    purchaseDate: { type: Date },
    purchaseCost: { type: Number, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true, maxlength: 3 },
    manufacturer: { type: String, trim: true, maxlength: 80 },
    model: { type: String, trim: true, maxlength: 80 },
    vendor: { type: String, trim: true, maxlength: 120 },
    warrantyEndDate: { type: Date },
    warrantyDetails: { type: String, trim: true, maxlength: 500 },
    location: { type: locationSchema, default: () => ({}) },
    tags: {
      type: [String],
      default: [],
      set: (v) => (Array.isArray(v) ? [...new Set(v.map((t) => t.trim()).filter(Boolean))] : []),
    },
    assignedTo: { type: Schema.Types.ObjectId, default: null, index: true },
    currentAllocation: { type: Schema.Types.ObjectId, default: null },
    imageUrl: { type: String, trim: true, maxlength: 500 },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    updatedBy: { type: Schema.Types.ObjectId, default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

assetSchema.index({ status: 1, category: 1, department: 1 });
assetSchema.index({ purchaseDate: 1 });
assetSchema.index({ assetId: 1, deletedAt: 1 });
assetSchema.index({ name: 'text', assetId: 'text', serialNumber: 'text', notes: 'text' });

assetSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Asset = model('Asset', assetSchema);
