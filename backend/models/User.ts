import mongoose, { Schema } from 'mongoose';
import type { Document, Types } from 'mongoose';

export type UserRole = 'admin' | 'teacher' | 'student';
export type UserStatus = 'active' | 'inactive';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  studentId?: string;
  teacherId?: string;
  phone?: string;
  profileImage?: string;
  classId?: Types.ObjectId | null;
  assignedSubjects: Types.ObjectId[];
  assignedClasses: Types.ObjectId[];
  status: UserStatus;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['admin', 'teacher', 'student'],
      required: true,
      default: 'student',
      index: true,
    },
    studentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    teacherId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    profileImage: {
      type: String,
      default: '',
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      default: null,
      index: true,
    },
    assignedSubjects: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Subject',
      },
    ],
    assignedClasses: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Class',
      },
    ],
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    resetTokenHash: {
      type: String,
      select: false,
    },
    resetTokenExpiresAt: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ role: 1, classId: 1 });
userSchema.index({ name: 'text', email: 'text', studentId: 'text', teacherId: 'text' });

export const User = mongoose.model<IUser>('User', userSchema);
