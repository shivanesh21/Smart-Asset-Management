import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * A single audit/activity event. Written by the asset-service itself and (via
 * the service-token internal API) by the operations-service, so admins get one
 * unified "who did what" feed.
 */
const activitySchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, default: null, index: true },
    actorEmail: { type: String, trim: true, lowercase: true, index: true },
    actorRole: { type: String, trim: true },
    /** Stable machine code, e.g. "auth.login", "asset.create", "maintenance.assign". */
    action: { type: String, required: true, trim: true, index: true },
    /** Business area, e.g. "asset", "allocation", "maintenance", "user", "auth". */
    resource: { type: String, trim: true, index: true },
    resourceId: { type: String, trim: true },
    /** Human-friendly one-liner shown in the admin feed. */
    summary: { type: String, trim: true, maxlength: 500 },
    method: { type: String, trim: true },
    path: { type: String, trim: true },
    statusCode: { type: Number },
    ip: { type: String, trim: true, maxlength: 64 },
    userAgent: { type: String, trim: true, maxlength: 300 },
    metadata: { type: Schema.Types.Mixed },
    /** Originating service: "asset-service" or "operations-service". */
    source: { type: String, trim: true, default: 'asset-service', index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

activitySchema.index({ createdAt: -1 });
activitySchema.index({ actorId: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });

activitySchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Activity = model('Activity', activitySchema);
