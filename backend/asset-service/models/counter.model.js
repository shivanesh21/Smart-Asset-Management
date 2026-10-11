import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const counterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

export const Counter = model('Counter', counterSchema);

const ASSET_ID_START = 1000;

export async function nextAssetId() {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'asset' },
    { $inc: { seq: 1 }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: true }
  );
  return `AST-${ASSET_ID_START + counter.seq}`;
}
