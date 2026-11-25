import { Router } from 'express';
import {
  createExam,
  deleteExam,
  getExamById,
  getExams,
  updateExam,
  updateExamStatus,
} from '../controllers/examController.ts';
import { startExamAttempt } from '../controllers/attemptController.ts';
import { getExamResults, publishExamResultsBulk } from '../controllers/resultController.ts';
import { authorize, protect } from '../middleware/auth.ts';

const router = Router();

router.use(protect);

router.get('/', getExams);
router.get('/:id', getExamById);
router.post('/', authorize('admin', 'teacher'), createExam);
router.put('/:id', authorize('admin', 'teacher'), updateExam);
router.patch('/:id/status', authorize('admin', 'teacher'), updateExamStatus);
router.delete('/:id', authorize('admin', 'teacher'), deleteExam);

router.post('/:id/start', authorize('student'), startExamAttempt);
router.get('/:id/results', authorize('admin', 'teacher'), getExamResults);
router.patch('/:id/results/publish', authorize('admin', 'teacher'), publishExamResultsBulk);

export default router;
