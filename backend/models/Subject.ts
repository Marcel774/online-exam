import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export interface ISubject extends Document {
  name: string;
  code: string;
  description: string;
  classId: Types.ObjectId;
  teacherId?: Types.ObjectId | null;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const subjectSchema = new Schema<ISubject>(
  {
    name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
      maxlength: 140,
    },
    code: {
      type: String,
      required: [true, 'Subject code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 30,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Assigned class is required'],
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
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

export const Subject = mongoose.model<ISubject>('Subject', subjectSchema);
