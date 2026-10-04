import mongoose from 'mongoose';
import { TECHNICIAN_STATUSES, TECHNICIAN_SKILLS } from '../constants/maintenance.js';

const { Schema, model } = mongoose;

const certificationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    issuedBy: { type: String, trim: true, maxlength: 120 },
    issuedOn: { type: Date },
    expiresOn: { type: Date },
    certificateUrl: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const technicianSchema = new Schema(
  {
    employeeCode: {
      type: String,
      required: [true, 'employeeCode is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
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
    phone: { type: String, trim: true, maxlength: 20 },
    status: {
      type: String,
      enum: TECHNICIAN_STATUSES,
      default: 'available',
      index: true,
    },
    skills: {
      type: [String],
      enum: TECHNICIAN_SKILLS,
      default: ['general'],
    },
    certifications: { type: [certificationSchema], default: [] },
    team: { type: String, trim: true, maxlength: 80, index: true },
    site: { type: String, trim: true, maxlength: 80 },
    shift: {
      type: String,
      enum: ['morning', 'evening', 'night', 'flexible'],
      default: 'flexible',
    },
    maxConcurrentJobs: { type: Number, default: 5, min: 1, max: 50 },
    activeJobCount: { type: Number, default: 0, min: 0 },
    hourlyRate: { type: Number, min: 0 },
    currency: { type: String, default: 'INR', uppercase: true, maxlength: 3 },
    linkedUser: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true, versionKey: false }
);

technicianSchema.index({ status: 1, skills: 1 });
technicianSchema.index({ team: 1, status: 1 });
technicianSchema.index({ name: 'text', employeeCode: 'text', email: 'text' });

technicianSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export const Technician = model('Technician', technicianSchema);
