import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export interface IResult extends Document {
  studentId: Types.ObjectId;
  examId: Types.ObjectId;
  attemptId: Types.ObjectId;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  passed: boolean;
  feedback: string;
  gradingStatus: 'pending' | 'graded';
  published: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const resultSchema = new Schema<IResult>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    examId: {
      type: Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },
    attemptId: {
      type: Schema.Types.ObjectId,
      ref: 'ExamAttempt',
      required: true,
      unique: true,
    },
    marksObtained: {
      type: Number,
      default: 0,
    },
    totalMarks: {
      type: Number,
      required: true,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    grade: {
      type: String,
      default: 'F',
    },
    passed: {
      type: Boolean,
      default: false,
    },
    feedback: {
      type: String,
      default: '',
    },
    gradingStatus: {
      type: String,
      enum: ['pending', 'graded'],
      default: 'pending',
      index: true,
    },
    published: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

resultSchema.index({ examId: 1, studentId: 1 });

export const Result = mongoose.model<IResult>('Result', resultSchema);
