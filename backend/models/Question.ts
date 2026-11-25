import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export type QuestionType = 'mcq' | 'true_false' | 'short_answer' | 'essay';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface IQuestion extends Document {
  questionText: string;
  questionType: QuestionType;
  options: string[];
  correctAnswer: string;
  expectedAnswer: string;
  marks: number;
  subjectId: Types.ObjectId;
  topic: string;
  difficulty: DifficultyLevel;
  explanation: string;
  teacherId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IQuestion>(
  {
    questionText: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    questionType: {
      type: String,
      enum: ['mcq', 'true_false', 'short_answer', 'essay'],
      required: true,
      index: true,
    },
    options: {
      type: [String],
      default: [],
    },
    correctAnswer: {
      type: String,
      trim: true,
      default: '',
    },
    expectedAnswer: {
      type: String,
      trim: true,
      default: '',
    },
    marks: {
      type: Number,
      required: true,
      min: [0.5, 'Marks must be at least 0.5'],
      default: 1,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject is required'],
      index: true,
    },
    topic: {
      type: String,
      trim: true,
      default: 'General',
      index: true,
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
      index: true,
    },
    explanation: {
      type: String,
      trim: true,
      default: '',
    },
    teacherId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

questionSchema.index({ questionText: 'text', topic: 'text' });

export const Question = mongoose.model<IQuestion>('Question', questionSchema);
