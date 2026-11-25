import { Router } from 'express';
import {
  createUser,
  deleteUser,
  getUserById,
  getUsers,
  importStudentsCsv,
  updateUser,
} from '../controllers/userController.ts';
import { authorize, protect } from '../middleware/auth.ts';

const router = Router();

router.use(protect);

router.get('/', authorize('admin', 'teacher'), getUsers);
router.get('/:id', authorize('admin', 'teacher'), getUserById);
router.post('/', authorize('admin'), createUser);
router.post('/import-csv', authorize('admin'), importStudentsCsv);
router.put('/:id', authorize('admin'), updateUser);
router.delete('/:id', authorize('admin'), deleteUser);

export default router;
