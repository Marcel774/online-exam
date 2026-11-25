import bcrypt from 'bcryptjs';
import type { NextFunction, Response } from 'express';
import { User } from '../models/User.ts';
import type { UserRole } from '../models/User.ts';
import { Subject } from '../models/Subject.ts';
import { ExamAttempt } from '../models/ExamAttempt.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { escapeRegex, generateUniqueCode, isValidObjectId } from '../utils/idGenerator.ts';
import { asCleanString, asObjectIdArray, asValidEmail } from '../validators/input.ts';

export async function getUsers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const roleFilter = asCleanString(req.query.role, 30);
    const statusFilter = asCleanString(req.query.status, 30);
    const classIdFilter = asCleanString(req.query.classId, 60);
    const search = asCleanString(req.query.search, 120);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const query: Record<string, unknown> = {};

    if (req.user?.role === 'teacher') {
      // Teachers can list students in their assigned classes
      query.role = 'student';
      if (classIdFilter && isValidObjectId(classIdFilter)) {
        query.classId = classIdFilter;
      } else if (req.user.assignedClasses?.length) {
        query.classId = { $in: req.user.assignedClasses };
      }
    } else {
      if (roleFilter && ['admin', 'teacher', 'student'].includes(roleFilter)) {
        query.role = roleFilter;
      }
      if (classIdFilter && isValidObjectId(classIdFilter)) {
        query.classId = classIdFilter;
      }
    }

    if (statusFilter && ['active', 'inactive'].includes(statusFilter)) {
      query.status = statusFilter;
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { studentId: regex },
        { teacherId: regex },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .populate('classId', 'name academicYear')
      .populate('assignedClasses', 'name academicYear')
      .populate('assignedSubjects', 'name code')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      users,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid user ID.', 400);
    }

    const user = await User.findById(id)
      .populate('classId', 'name academicYear')
      .populate('assignedClasses', 'name academicYear')
      .populate('assignedSubjects', 'name code')
      .lean();

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const attempts = await ExamAttempt.find({ studentId: user._id })
      .populate('examId', 'title examType totalMarks startDate')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ user, attempts });
  } catch (err) {
    next(err);
  }
}

export async function createUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const name = asCleanString(req.body.name, 120);
    const email = asValidEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const role = (asCleanString(req.body.role, 20) || 'student') as UserRole;
    const phone = asCleanString(req.body.phone, 40);
    const status = req.body.status === 'inactive' ? 'inactive' : 'active';
    const classId = isValidObjectId(req.body.classId) ? req.body.classId : null;
    const assignedClasses = asObjectIdArray(req.body.assignedClasses);
    const assignedSubjects = asObjectIdArray(req.body.assignedSubjects);

    if (!name) throw new AppError('Full name is required.', 400);
    if (!email) throw new AppError('Valid email is required.', 400);
    if (!['admin', 'teacher', 'student'].includes(role)) {
      throw new AppError('Invalid role specified.', 400);
    }
    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters.', 400);
    }

    const existing = await User.exists({ email });
    if (existing) {
      throw new AppError('A user with that email already exists.', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let studentId: string | undefined;
    let teacherId: string | undefined;

    if (role === 'student') {
      studentId = asCleanString(req.body.studentId, 40) || (await generateUniqueCode('student'));
    } else if (role === 'teacher') {
      teacherId = asCleanString(req.body.teacherId, 40) || (await generateUniqueCode('teacher'));
    }

    const defaultAvatar =
      role === 'admin'
        ? '/src/assets/images/avatar_admin_director_1795592793545.jpg'
        : role === 'teacher'
        ? '/src/assets/images/avatar_faculty_teacher_1795592794370.jpg'
        : '/src/assets/images/avatar_scholar_student_1795592795326.jpg';

    const profileImage = asCleanString(req.body.profileImage, 500) || defaultAvatar;

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      studentId,
      teacherId,
      phone,
      profileImage,
      classId: role === 'student' ? classId : null,
      assignedClasses: role === 'teacher' ? assignedClasses : [],
      assignedSubjects: role === 'teacher' ? assignedSubjects : [],
      status,
    });

    if (role === 'teacher' && assignedSubjects.length > 0) {
      await Subject.updateMany(
        { _id: { $in: assignedSubjects } },
        { $set: { teacherId: user._id } }
      );
    }

    const populated = await User.findById(user._id)
      .populate('classId', 'name academicYear')
      .populate('assignedClasses', 'name academicYear')
      .populate('assignedSubjects', 'name code')
      .lean();

    res.status(201).json({
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully.`,
      user: populated,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid user ID.', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const name = asCleanString(req.body.name, 120);
    const email = req.body.email !== undefined ? asValidEmail(req.body.email) : user.email;
    const phone = asCleanString(req.body.phone, 40);
    const status = req.body.status;
    const role = req.body.role;

    if (req.body.email !== undefined && !email) {
      throw new AppError('Invalid email address.', 400);
    }

    if (email && email !== user.email) {
      const taken = await User.exists({ email, _id: { $ne: user._id } });
      if (taken) throw new AppError('Email is already assigned to another user.', 409);
      user.email = email;
    }

    if (name) user.name = name;
    if (req.body.phone !== undefined) user.phone = phone;
    if (status === 'active' || status === 'inactive') {
      if (user._id.toString() === req.user?._id.toString() && status === 'inactive') {
        throw new AppError('You cannot deactivate your own active administrator account.', 400);
      }
      user.status = status;
    }

    if (role && ['admin', 'teacher', 'student'].includes(role)) {
      user.role = role;
      if (role === 'student' && !user.studentId) {
        user.studentId = await generateUniqueCode('student');
      }
      if (role === 'teacher' && !user.teacherId) {
        user.teacherId = await generateUniqueCode('teacher');
      }
    }

    if (req.body.classId !== undefined) {
      user.classId = isValidObjectId(req.body.classId) ? (req.body.classId as unknown as typeof user.classId) : null;
    }

    if (Array.isArray(req.body.assignedClasses)) {
      user.assignedClasses = asObjectIdArray(req.body.assignedClasses) as unknown as typeof user.assignedClasses;
    }

    if (Array.isArray(req.body.assignedSubjects)) {
      const subjectIds = asObjectIdArray(req.body.assignedSubjects);
      user.assignedSubjects = subjectIds as unknown as typeof user.assignedSubjects;
      if (user.role === 'teacher') {
        await Subject.updateMany({ teacherId: user._id }, { $set: { teacherId: null } });
        if (subjectIds.length > 0) {
          await Subject.updateMany(
            { _id: { $in: subjectIds } },
            { $set: { teacherId: user._id } }
          );
        }
      }
    }

    if (typeof req.body.password === 'string' && req.body.password.length >= 6) {
      user.password = await bcrypt.hash(req.body.password, 10);
    }

    await user.save();

    const populated = await User.findById(user._id)
      .populate('classId', 'name academicYear')
      .populate('assignedClasses', 'name academicYear')
      .populate('assignedSubjects', 'name code')
      .lean();

    res.json({
      message: 'User updated successfully.',
      user: populated,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid user ID.', 400);
    }
    if (req.user?._id.toString() === id) {
      throw new AppError('You cannot delete your own active account.', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const hasAttempts = await ExamAttempt.exists({ studentId: user._id });
    if (hasAttempts) {
      user.status = 'inactive';
      await user.save();
      res.json({
        message: 'User has historical exam records and was deactivated instead of permanently deleted.',
        deactivated: true,
      });
      return;
    }

    await User.deleteOne({ _id: user._id });
    res.json({ message: 'User deleted successfully.', deactivated: false });
  } catch (err) {
    next(err);
  }
}

export async function importStudentsCsv(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rows = Array.isArray(req.body.students) ? req.body.students : [];
    const defaultClassId = isValidObjectId(req.body.defaultClassId) ? req.body.defaultClassId : null;

    if (rows.length === 0) {
      throw new AppError('No student records provided for import.', 400);
    }
    if (rows.length > 200) {
      throw new AppError('CSV import supports up to 200 students per batch.', 400);
    }

    let createdCount = 0;
    const skipped: { email: string; reason: string }[] = [];

    for (const row of rows) {
      const name = asCleanString(row?.name, 120);
      const email = asValidEmail(row?.email);
      const phone = asCleanString(row?.phone, 40);
      const rawPassword = typeof row?.password === 'string' && row.password.length >= 6 ? row.password : '';
      const rowClassId = isValidObjectId(row?.classId) ? row.classId : defaultClassId;

      if (!name || !email) {
        skipped.push({ email: String(row?.email || 'unknown'), reason: 'Missing valid name or email' });
        continue;
      }

      if (!rawPassword) {
        skipped.push({ email, reason: 'Missing password (min 6 characters)' });
        continue;
      }

      const exists = await User.exists({ email });
      if (exists) {
        skipped.push({ email, reason: 'Email already exists' });
        continue;
      }

      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const studentId = await generateUniqueCode('student');

      await User.create({
        name,
        email,
        password: hashedPassword,
        role: 'student',
        studentId,
        phone,
        classId: rowClassId,
        profileImage: '/src/assets/images/avatar_scholar_student_1795592795326.jpg',
        status: 'active',
      });
      createdCount++;
    }

    res.status(201).json({
      message: `Imported ${createdCount} student(s).${skipped.length ? ` Skipped ${skipped.length} row(s).` : ''}`,
      createdCount,
      skipped,
    });
  } catch (err) {
    next(err);
  }
}
