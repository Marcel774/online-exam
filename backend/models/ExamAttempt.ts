import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export interface IAttemptAnswer {
  questionId: Types.ObjectId;
  answer: string;
  flagged: boolean;
  savedAt: Date;
  marksAwarded: number;
  isCorrect: boolean;
  graded: boolean;
  teacherFeedback: string;
}

export type AttemptStatus = 'in_progress' | 'submitted' | 'graded' | 'expired';

export interface IExamAttempt extends Document {
  studentId: Types.ObjectId;
  examId: Types.ObjectId;
  assignedQuestionIds: Types.ObjectId[];
  answers: IAttemptAnswer[];
  startedAt: Date;
  expiresAt: Date;
  submittedAt?: Date;
  score: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  passed: boolean;
  status: AttemptStatus;
  attemptNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

const attemptAnswerSchema = new Schema<IAttemptAnswer>(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    answer: {
      type: String,
      default: '',
    },
    flagged: {
      type: Boolean,
      default: false,
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
    marksAwarded: {
      type: Number,
      default: 0,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
    graded: {
      type: Boolean,
      default: false,
    },
    teacherFeedback: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const examAttemptSchema = new Schema<IExamAttempt>(
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
    assignedQuestionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    answers: [attemptAnswerSchema],
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    submittedAt: {
      type: Date,
    },
    score: {
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
    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'graded', 'expired'],
      default: 'in_progress',
      index: true,
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

examAttemptSchema.index({ studentId: 1, examId: 1, attemptNumber: 1 }, { unique: true });

export const ExamAttempt = mongoose.model<IExamAttempt>('ExamAttempt', examAttemptSchema);
