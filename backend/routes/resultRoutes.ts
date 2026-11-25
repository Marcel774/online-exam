import { Router } from 'express';
import {
  getResultById,
  getResults,
  gradeResult,
  publishResult,
} from '../controllers/resultController.ts';
import { authorize, protect } from '../middleware/auth.ts';

const router = Router();

router.use(protect);

router.get('/', getResults);
router.get('/:id', getResultById);
router.patch('/:id/grade', authorize('admin', 'teacher'), gradeResult);
router.patch('/:id/publish', authorize('admin', 'teacher'), publishResult);

export default router;
