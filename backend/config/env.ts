import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const runtimeFallbackSecret = crypto.randomBytes(32).toString('hex');

export const env = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: (process.env.MONGODB_URI || '').trim(),
  jwtSecret: (process.env.JWT_SECRET || '').trim() || runtimeFallbackSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: (process.env.CORS_ORIGIN || '').trim(),
  adminBootstrapPasscode: (process.env.ADMIN_BOOTSTRAP_PASSCODE || '').trim(),
  appUrl: (process.env.APP_URL || '').trim(),
};
