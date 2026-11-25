import { Router } from 'express';
import {
  createClass,
  deleteClass,
  getClasses,
  getPublicClasses,
  updateClass,
} from '../controllers/classController.ts';
import { authorize, protect } from '../middleware/auth.ts';

const router = Router();

router.get('/public', getPublicClasses);
router.get('/', protect, getClasses);
router.post('/', protect, authorize('admin'), createClass);
router.put('/:id', protect, authorize('admin'), updateClass);
router.delete('/:id', protect, authorize('admin'), deleteClass);

export default router;
