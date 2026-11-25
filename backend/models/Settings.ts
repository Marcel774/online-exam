import mongoose, { Schema } from 'mongoose';
import type { Document } from 'mongoose';

export interface IGradingScaleBand {
  grade: string;
  minPercentage: number;
  maxPercentage: number;
  label: string;
}

export interface ISettings extends Document {
  institutionName: string;
  academicYear: string;
  defaultExamDuration: number;
  allowSelfRegistration: boolean;
  gradingScale: IGradingScaleBand[];
  updatedAt: Date;
}

export const DEFAULT_GRADING_SCALE: IGradingScaleBand[] = [
  { grade: 'A', minPercentage: 80, maxPercentage: 100, label: 'Distinction' },
  { grade: 'B', minPercentage: 70, maxPercentage: 79, label: 'Merit' },
  { grade: 'C', minPercentage: 60, maxPercentage: 69, label: 'Credit' },
  { grade: 'D', minPercentage: 50, maxPercentage: 59, label: 'Pass' },
  { grade: 'F', minPercentage: 0, maxPercentage: 49, label: 'Fail' },
];

const settingsSchema = new Schema<ISettings>(
  {
    institutionName: {
      type: String,
      default: 'EXAMPRO Academy',
      trim: true,
    },
    academicYear: {
      type: String,
      default: '2026-2027',
      trim: true,
    },
    defaultExamDuration: {
      type: Number,
      default: 60,
      min: 5,
    },
    allowSelfRegistration: {
      type: Boolean,
      default: true,
    },
    gradingScale: {
      type: [
        {
          grade: { type: String, required: true },
          minPercentage: { type: Number, required: true },
          maxPercentage: { type: Number, required: true },
          label: { type: String, default: '' },
        },
      ],
      default: DEFAULT_GRADING_SCALE,
    },
  },
  {
    timestamps: true,
  }
);

export const Settings = mongoose.model<ISettings>('Settings', settingsSchema);
