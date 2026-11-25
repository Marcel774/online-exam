import { Router } from 'express';
import {
  createQuestion,
  deleteQuestion,
  getQuestionById,
  getQuestions,
  updateQuestion,
} from '../controllers/questionController.ts';
import { authorize, protect } from '../middleware/auth.ts';

const router = Router();

router.use(protect, authorize('admin', 'teacher'));

router.get('/', getQuestions);
router.get('/:id', getQuestionById);
router.post('/', createQuestion);
router.put('/:id', updateQuestion);
router.delete('/:id', deleteQuestion);

export default router;
