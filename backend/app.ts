import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { env } from './config/env.ts';
import { csrfProtection } from './middleware/auth.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import { apiRateLimiter } from './middleware/rateLimiter.ts';
import { hasNoSqlOperator } from './validators/input.ts';

import authRoutes from './routes/authRoutes.ts';
import userRoutes from './routes/userRoutes.ts';
import classRoutes from './routes/classRoutes.ts';
import subjectRoutes from './routes/subjectRoutes.ts';
import questionRoutes from './routes/questionRoutes.ts';
import examRoutes from './routes/examRoutes.ts';
import attemptRoutes from './routes/attemptRoutes.ts';
import resultRoutes from './routes/resultRoutes.ts';
import dashboardRoutes from './routes/dashboardRoutes.ts';

export function createExpressApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      xFrameOptions: false,
    })
  );

  const allowedOrigins = env.corsOrigin
    ? env.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Origin not allowed by CORS'));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Reject NoSQL operator keys ($gt, $ne, etc.)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (hasNoSqlOperator(req.body) || hasNoSqlOperator(req.query)) {
      res.status(400).json({ message: 'Invalid input structure.' });
      return;
    }
    next();
  });

  app.use('/api', apiRateLimiter);
  app.use('/api', csrfProtection);

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'EXAMPRO API' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/classes', classRoutes);
  app.use('/api/subjects', subjectRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/exams', examRoutes);
  app.use('/api/attempts', attemptRoutes);
  app.use('/api/results', resultRoutes);
  app.use('/api', dashboardRoutes);

  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ message: 'API endpoint not found.' });
  });

  app.use(errorHandler);

  return app;
}
