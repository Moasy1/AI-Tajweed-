import mongoose, { Document, Schema } from 'mongoose';

export interface IWordAnalysis {
  text: string;
  status: 'correct' | 'error';
  rule: string;
  suggestion: string;
  accuracy: number;
}

export interface IRecitationSession extends Document {
  userId: mongoose.Types.ObjectId | string;
  surah: string;
  ayah: string;
  score: number;
  words: IWordAnalysis[];
  durationSeconds?: number;
  mode: 'tajweed' | 'interactive' | 'kids';
  createdAt: Date;
}

const WordAnalysisSchema = new Schema<IWordAnalysis>(
  {
    text: { type: String, required: true },
    status: { type: String, enum: ['correct', 'error'], required: true },
    rule: { type: String, default: '' },
    suggestion: { type: String, default: '' },
    accuracy: { type: Number, min: 0, max: 100, default: 100 },
  },
  { _id: false }
);

const RecitationSessionSchema = new Schema<IRecitationSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: false },
    surah: { type: String, required: true },
    ayah: { type: String, default: '' },
    score: { type: Number, min: 0, max: 100, required: true },
    words: { type: [WordAnalysisSchema], default: [] },
    durationSeconds: { type: Number, min: 0 },
    mode: { type: String, enum: ['tajweed', 'interactive', 'kids'], default: 'tajweed' },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying by user and date
RecitationSessionSchema.index({ userId: 1, createdAt: -1 });
RecitationSessionSchema.index({ score: -1 });

export const RecitationSession =
  mongoose.models.RecitationSession ||
  mongoose.model<IRecitationSession>('RecitationSession', RecitationSessionSchema);
