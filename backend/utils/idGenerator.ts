import mongoose from 'mongoose';
import { User } from '../models/User.ts';

export async function generateUniqueCode(role: 'student' | 'teacher'): Promise<string> {
  const prefix = role === 'student' ? 'STU' : 'TCH';
  const year = new Date().getFullYear();

  for (let i = 0; i < 10; i++) {
    const rand = Math.floor(1000 + Math.random() * 9000);
    const code = `${prefix}-${year}-${rand}`;
    const existing = await User.exists(
      role === 'student' ? { studentId: code } : { teacherId: code }
    );
    if (!existing) {
      return code;
    }
  }
  return `${prefix}-${year}-${Date.now().toString().slice(-5)}`;
}

export function isValidObjectId(value: unknown): value is string {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
