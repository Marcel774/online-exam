import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.ts';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  const error = err as {
    name?: string;
    code?: number;
    message?: string;
    errors?: Record<string, { message: string }>;
  };

  if (error.name === 'ValidationError' && error.errors) {
    const firstMsg = Object.values(error.errors)[0]?.message || 'Validation failed';
    res.status(400).json({ message: firstMsg });
    return;
  }

  if (error.name === 'CastError') {
    res.status(400).json({ message: 'Invalid resource identifier format.' });
    return;
  }

  if (error.code === 11000) {
    res.status(409).json({ message: 'A record with that unique value already exists.' });
    return;
  }

  if (env.nodeEnv !== 'production') {
    console.error('Unhandled API Error:', err);
  }

  res.status(500).json({ message: 'An unexpected server error occurred.' });
}
