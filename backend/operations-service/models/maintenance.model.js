import mongoose from 'mongoose';
import {
  MAINTENANCE_TYPES,
  MAINTENANCE_PRIORITIES,
  MAINTENANCE_STATUSES,
} from '../constants/maintenance.js';

const { Schema, model } = mongoose;

const partUsedSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    partNumber: { type: String, trim: true, uppercase: true, maxlength: 64 },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, min: 0 },
    supplier: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false }
);

const maintenanceSchema = new Schema(
  {
    maintenanceId: {
      type: String,
      required: [true, 'maintenanceId is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^MNT-\d{4}-\d{4,}$/, 'maintenanceId must look like MNT-2026-0001'],
    },
    assetId: {
      type: Schema.Types.ObjectId,
      required: [true, 'assetId is required'],
      index: true,
    },
    assetTag: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
      match: [/^AST-\d{4,}$/, 'assetTag must look like AST-1001'],
    },
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
      minlength: 3,
      maxlength: 160,
    },
    description: { type: String, trim: true, maxlength: 4000 },
    type: {
      type: String,
      enum: MAINTENANCE_TYPES,
      required: [true, 'type is required'],
      index: true,
    },
    priority: {
      type: String,
      enum: MAINTENANCE_PRIORITIES,
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: MAINTENANCE_STATUSES,
      default: 'requested',
      index: true,
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      required: [true, 'reportedBy is required'],
    },
    assignedTechnician: {
      type: Schema.Types.ObjectId,
      ref: 'Technician',
      default: null,
      index: true,
    },
    scheduledFor: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    onHoldReason: { type: String, trim: true, maxlength: 500 },
    cancelledReason: { type: String, trim: true, maxlength: 500 },
    resolutionNotes: { type: String, trim: true, maxlength: 4000 },
    partsUsed: { type: [partUsedSchema], default: [] },
    laborHours: { type: Number, min: 0 },
    cost: {
      laborCost: { type: Number, min: 0, default: 0 },
      partsCost: { type: Number, min: 0, default: 0 },
      totalCost: { type: Number, min: 0, default: 0 },
      currency: { type: String, default: 'INR', uppercase: true, maxlength: 3 },
    },
    downtimeHours: { type: Number, min: 0, default: 0 },
    recurring: {
      enabled: { type: Boolean, default: false },
      intervalDays: { type: Number, min: 1 },
      nextDueDate: { type: Date },
    },
    attachments: [
      {
        name: String,
        url: String,
        mimeType: String,
        sizeBytes: Number,
        uploadedBy: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    auditTrail: [
      {
        action: { type: String, required: true },
        fromStatus: String,
        toStatus: String,
        actorId: { type: Schema.Types.ObjectId },
        actorRole: String,
        note: String,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, optimisticConcurrency: true }
);

maintenanceSchema.index({ status: 1, priority: 1, scheduledFor: 1 });
maintenanceSchema.index({ assetId: 1, status: 1 });
maintenanceSchema.index({ assignedTechnician: 1, status: 1 });
maintenanceSchema.index({ 'recurring.enabled': 1, 'recurring.nextDueDate': 1 });
maintenanceSchema.index({ title: 'text', description: 'text', assetTag: 'text' });

maintenanceSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Maintenance = model('Maintenance', maintenanceSchema);
