import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export type ExamType = 'quiz' | 'test' | 'midterm' | 'final' | 'practice';
export type ExamStatus = 'draft' | 'scheduled' | 'published' | 'active' | 'completed' | 'archived';

export interface IExam extends Document {
  title: string;
  description: string;
  subjectId: Types.ObjectId;
  classId: Types.ObjectId;
  teacherId: Types.ObjectId;
  examType: ExamType;
  questions: Types.ObjectId[];
  randomSelection: {
    enabled: boolean;
    count: number;
    difficulty: string;
  };
  startDate: Date;
  endDate: Date;
  duration: number;
  totalMarks: number;
  passingMarks: number;
  instructions: string;
  attemptsAllowed: number;
  status: ExamStatus;
  createdAt: Date;
  updatedAt: Date;
}

const examSchema = new Schema<IExam>(
  {
    title: {
      type: String,
      required: [true, 'Examination title is required'],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: [true, 'Class is required'],
      index: true,
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher is required'],
      index: true,
    },
    examType: {
      type: String,
      enum: ['quiz', 'test', 'midterm', 'final', 'practice'],
      default: 'quiz',
    },
    questions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    randomSelection: {
      enabled: { type: Boolean, default: false },
      count: { type: Number, default: 0, min: 0 },
      difficulty: { type: String, default: 'all' },
    },
    startDate: {
      type: Date,
      required: [true, 'Start date and time is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date and time is required'],
      index: true,
    },
    duration: {
      type: Number,
      required: [true, 'Duration in minutes is required'],
      min: [1, 'Duration must be at least 1 minute'],
    },
    totalMarks: {
      type: Number,
      required: [true, 'Total marks are required'],
      min: [1, 'Total marks must be at least 1'],
    },
    passingMarks: {
      type: Number,
      required: [true, 'Passing marks are required'],
      min: [0, 'Passing marks cannot be negative'],
    },
    instructions: {
      type: String,
      trim: true,
      default: 'Read every question carefully before answering. Your responses are saved automatically.',
    },
    attemptsAllowed: {
      type: Number,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'published', 'active', 'completed', 'archived'],
      default: 'draft',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

examSchema.index({ classId: 1, status: 1, startDate: 1 });
examSchema.index({ title: 'text', description: 'text' });

export const Exam = mongoose.model<IExam>('Exam', examSchema);
