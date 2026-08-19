import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  avatar: string;
  points: number;
  badges: string[];
  streak: number;
  totalVerses: number;
  totalHours: number;
  tajweedAccuracy: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    avatar: { type: String, default: '' },
    points: { type: Number, default: 0, min: 0 },
    badges: { type: [String], default: [] },
    streak: { type: Number, default: 0, min: 0 },
    totalVerses: { type: Number, default: 0, min: 0 },
    totalHours: { type: Number, default: 0, min: 0 },
    tajweedAccuracy: { type: Number, default: 0, min: 0, max: 100 },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
