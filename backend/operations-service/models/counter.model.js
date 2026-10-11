import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

const Counter = model('Counter', counterSchema);

/**
 * Atomically increments the maintenance sequence and returns an id like
 * `MNT-2026-0001` (matches the Maintenance.maintenanceId pattern).
 */
export async function nextMaintenanceId() {
  const year = new Date().getFullYear();
  const doc = await Counter.findByIdAndUpdate(
    'maintenanceId',
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `MNT-${year}-${String(doc.seq).padStart(4, '0')}`;
}

export { Counter };