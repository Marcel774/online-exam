import type { NextFunction, Request, Response } from 'express';
import { ClassModel } from '../models/Class.ts';
import { User } from '../models/User.ts';
import { Subject } from '../models/Subject.ts';
import { Exam } from '../models/Exam.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { escapeRegex, isValidObjectId } from '../utils/idGenerator.ts';
import { asCleanString } from '../validators/input.ts';

export async function getClasses(
  req: AuthenticatedRequest | Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const search = asCleanString(req.query.search, 120);
    const status = asCleanString(req.query.status, 30);

    const query: Record<string, unknown> = {};
    if (status && ['active', 'archived'].includes(status)) {
      query.status = status;
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ name: regex }, { academicYear: regex }, { description: regex }];
    }

    if (authReq.user?.role === 'teacher') {
      const subjectClassIds = await Subject.distinct('classId', { teacherId: authReq.user._id });
      const combinedIds = [
        ...(authReq.user.assignedClasses || []),
        ...subjectClassIds,
      ];
      query._id = { $in: combinedIds };
    } else if (authReq.user?.role === 'student' && authReq.user.classId) {
      query._id = authReq.user.classId;
    }

    const classes = await ClassModel.find(query).sort({ createdAt: -1 }).lean();

    const enriched = await Promise.all(
      classes.map(async (cls) => {
        const [studentCount, subjectCount, teacherList] = await Promise.all([
          User.countDocuments({ role: 'student', classId: cls._id, status: 'active' }),
          Subject.countDocuments({ classId: cls._id, status: 'active' }),
          User.find({ role: 'teacher', assignedClasses: cls._id })
            .select('name email teacherId')
            .lean(),
        ]);
        return {
          ...cls,
          studentCount,
          subjectCount,
          teachers: teacherList,
        };
      })
    );

    res.json({ classes: enriched });
  } catch (err) {
    next(err);
  }
}

export async function getPublicClasses(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const classes = await ClassModel.find({ status: 'active' })
      .select('name academicYear')
      .sort({ name: 1 })
      .lean();
    res.json({ classes });
  } catch (err) {
    next(err);
  }
}

export async function createClass(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const name = asCleanString(req.body.name, 120);
    const academicYear = asCleanString(req.body.academicYear, 40) || '2026-2027';
    const description = asCleanString(req.body.description, 500);

    if (!name) {
      throw new AppError('Class name is required.', 400);
    }

    const created = await ClassModel.create({
      name,
      academicYear,
      description,
      status: 'active',
    });

    res.status(201).json({
      message: 'Class created successfully.',
      classItem: created,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateClass(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid class ID.', 400);
    }

    const classDoc = await ClassModel.findById(id);
    if (!classDoc) {
      throw new AppError('Class not found.', 404);
    }

    const name = asCleanString(req.body.name, 120);
    const academicYear = asCleanString(req.body.academicYear, 40);
    const description = asCleanString(req.body.description, 500);
    const status = req.body.status;

    if (name) classDoc.name = name;
    if (academicYear) classDoc.academicYear = academicYear;
    if (req.body.description !== undefined) classDoc.description = description;
    if (status === 'active' || status === 'archived') classDoc.status = status;

    await classDoc.save();
    res.json({ message: 'Class updated successfully.', classItem: classDoc });
  } catch (err) {
    next(err);
  }
}

export async function deleteClass(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid class ID.', 400);
    }

    const classDoc = await ClassModel.findById(id);
    if (!classDoc) {
      throw new AppError('Class not found.', 404);
    }

    const [hasStudents, hasExams, hasSubjects] = await Promise.all([
      User.exists({ classId: classDoc._id }),
      Exam.exists({ classId: classDoc._id }),
      Subject.exists({ classId: classDoc._id }),
    ]);

    if (hasStudents || hasExams || hasSubjects) {
      classDoc.status = 'archived';
      await classDoc.save();
      res.json({
        message: 'Class has linked students, subjects, or exams and was archived instead of permanently deleted.',
        archived: true,
      });
      return;
    }

    await ClassModel.deleteOne({ _id: classDoc._id });
    res.json({ message: 'Class deleted successfully.', archived: false });
  } catch (err) {
    next(err);
  }
}
