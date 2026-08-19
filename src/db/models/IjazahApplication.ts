import mongoose, { Document, Schema } from 'mongoose';

export type IjazahStatus = 'pending' | 'ai_approved' | 'sheikh_review' | 'approved' | 'rejected';

export interface IIjazahApplication extends Document {
  userId: mongoose.Types.ObjectId | string;
  surah: string;
  accuracy: number;
  status: IjazahStatus;
  sessionId?: mongoose.Types.ObjectId;
  sheikhNotes?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IjazahApplicationSchema = new Schema<IIjazahApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    surah: { type: String, required: true },
    accuracy: { type: Number, min: 0, max: 100, required: true },
    status: {
      type: String,
      enum: ['pending', 'ai_approved', 'sheikh_review', 'approved', 'rejected'],
      default: 'pending',
    },
    sessionId: { type: Schema.Types.ObjectId, ref: 'RecitationSession' },
    sheikhNotes: { type: String, default: '' },
    reviewedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

IjazahApplicationSchema.index({ userId: 1, status: 1 });
IjazahApplicationSchema.index({ createdAt: -1 });

export const IjazahApplication =
  mongoose.models.IjazahApplication ||
  mongoose.model<IIjazahApplication>('IjazahApplication', IjazahApplicationSchema);
