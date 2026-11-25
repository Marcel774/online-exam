import mongoose, { Schema } from 'mongoose';
import type { Document } from 'mongoose';

export interface IClass extends Document {
  name: string;
  academicYear: string;
  description: string;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const classSchema = new Schema<IClass>(
  {
    name: {
      type: String,
      required: [true, 'Class name is required'],
      trim: true,
      maxlength: 120,
    },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      default: '2026-2027',
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

classSchema.index({ name: 1, academicYear: 1 }, { unique: true });

export const ClassModel = mongoose.model<IClass>('Class', classSchema);
