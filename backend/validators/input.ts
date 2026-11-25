import { isValidObjectId } from '../utils/idGenerator.ts';

export function asCleanString(value: unknown, maxLength = 2000): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

export function asValidEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180) {
    return null;
  }
  return email;
}

export function asPositiveNumber(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return fallback;
}

export function asObjectIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => isValidObjectId(item));
}

export function hasNoSqlOperator(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (key.startsWith('$') || key.includes('.')) return true;
    if (typeof val === 'object' && val !== null && hasNoSqlOperator(val)) return true;
  }
  return false;
}
