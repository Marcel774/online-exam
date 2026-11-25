import { Router } from 'express';
import {
  getAttemptById,
  getMyAttempts,
  saveAttemptAnswers,
  submitAttempt,
} from '../controllers/attemptController.ts';
import { authorize, protect } from '../middleware/auth.ts';

const router = Router();

router.use(protect);

router.get('/my', authorize('student'), getMyAttempts);
router.get('/:id', getAttemptById);
router.put('/:id/answers', authorize('student'), saveAttemptAnswers);
router.post('/:id/submit', authorize('student'), submitAttempt);

export default router;
