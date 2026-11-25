import { Router } from 'express';
import {
  bootstrapWorkspace,
  forgotPassword,
  getMe,
  getSetupStatus,
  login,
  logout,
  register,
  resetPassword,
  updateProfile,
} from '../controllers/authController.ts';
import { protect } from '../middleware/auth.ts';
import { authRateLimiter } from '../middleware/rateLimiter.ts';

const router = Router();

router.get('/setup-status', getSetupStatus);
router.post('/bootstrap', authRateLimiter, bootstrapWorkspace);
router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.post('/logout', logout);
router.post('/forgot-password', authRateLimiter, forgotPassword);
router.post('/reset-password', authRateLimiter, resetPassword);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

export default router;
