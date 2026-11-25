import { Router } from 'express';
import {
  createSubject,
  deleteSubject,
  getSubjects,
  updateSubject,
} from '../controllers/subjectController.ts';
import { authorize, protect } from '../middleware/auth.ts';

const router = Router();

router.use(protect);

router.get('/', getSubjects);
router.post('/', authorize('admin'), createSubject);
router.put('/:id', authorize('admin'), updateSubject);
router.delete('/:id', authorize('admin'), deleteSubject);

export default router;
