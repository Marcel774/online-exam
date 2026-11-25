import { Router } from 'express';
import {
  getDashboardStats,
  getNotifications,
  getReports,
  getSettings,
  globalSearch,
  updateSettings,
} from '../controllers/dashboardController.ts';
import { authorize, protect } from '../middleware/auth.ts';

const router = Router();

router.use(protect);

router.get('/dashboard/stats', getDashboardStats);
router.get('/reports', authorize('admin', 'teacher'), getReports);
router.get('/settings', getSettings);
router.put('/settings', authorize('admin'), updateSettings);
router.get('/search', globalSearch);
router.get('/notifications', getNotifications);

export default router;
