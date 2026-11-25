import type { NextFunction, Response } from 'express';
import { Subject } from '../models/Subject.ts';
import { User } from '../models/User.ts';
import { Exam } from '../models/Exam.ts';
import { Question } from '../models/Question.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { escapeRegex, isValidObjectId } from '../utils/idGenerator.ts';
import { asCleanString } from '../validators/input.ts';

export async function getSubjects(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const search = asCleanString(req.query.search, 120);
    const classId = asCleanString(req.query.classId, 60);
    const status = asCleanString(req.query.status, 30);

    const query: Record<string, unknown> = {};
    if (status && ['active', 'archived'].includes(status)) {
      query.status = status;
    }
    if (classId && isValidObjectId(classId)) {
      query.classId = classId;
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [{ name: regex }, { code: regex }, { description: regex }];
    }

    if (req.user?.role === 'teacher') {
      const assignedIds = req.user.assignedSubjects || [];
      query.$and = [
        ...(Array.isArray(query.$and) ? query.$and : []),
        { $or: [{ teacherId: req.user._id }, { _id: { $in: assignedIds } }] },
      ];
    } else if (req.user?.role === 'student' && req.user.classId) {
      query.classId = req.user.classId;
      query.status = 'active';
    }

    const subjects = await Subject.find(query)
      .populate('classId', 'name academicYear')
      .populate('teacherId', 'name email teacherId')
      .sort({ createdAt: -1 })
      .lean();

    const enriched = await Promise.all(
      subjects.map(async (sub) => {
        const [questionCount, examCount] = await Promise.all([
          Question.countDocuments({ subjectId: sub._id }),
          Exam.countDocuments({ subjectId: sub._id }),
        ]);
        return { ...sub, questionCount, examCount };
      })
    );

    res.json({ subjects: enriched });
  } catch (err) {
    next(err);
  }
}

export async function createSubject(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const name = asCleanString(req.body.name, 140);
    const code = asCleanString(req.body.code, 30).toUpperCase();
    const description = asCleanString(req.body.description, 500);
    const classId = req.body.classId;
    const teacherId = isValidObjectId(req.body.teacherId) ? req.body.teacherId : null;

    if (!name || !code) {
      throw new AppError('Subject name and code are required.', 400);
    }
    if (!isValidObjectId(classId)) {
      throw new AppError('Valid class assignment is required.', 400);
    }

    const created = await Subject.create({
      name,
      code,
      description,
      classId,
      teacherId,
      status: 'active',
    });

    if (teacherId) {
      await User.updateOne(
        { _id: teacherId, role: 'teacher' },
        { $addToSet: { assignedSubjects: created._id, assignedClasses: classId } }
      );
    }

    const populated = await Subject.findById(created._id)
      .populate('classId', 'name academicYear')
      .populate('teacherId', 'name email teacherId')
      .lean();

    res.status(201).json({
      message: 'Subject created successfully.',
      subject: populated,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateSubject(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid subject ID.', 400);
    }

    const subject = await Subject.findById(id);
    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    const name = asCleanString(req.body.name, 140);
    const code = asCleanString(req.body.code, 30).toUpperCase();
    const description = asCleanString(req.body.description, 500);
    const status = req.body.status;

    if (name) subject.name = name;
    if (code) subject.code = code;
    if (req.body.description !== undefined) subject.description = description;
    if (isValidObjectId(req.body.classId)) {
      subject.classId = req.body.classId as unknown as typeof subject.classId;
    }
    if (req.body.teacherId !== undefined) {
      const nextTeacherId = isValidObjectId(req.body.teacherId) ? req.body.teacherId : null;
      subject.teacherId = nextTeacherId as unknown as typeof subject.teacherId;
      if (nextTeacherId) {
        await User.updateOne(
          { _id: nextTeacherId, role: 'teacher' },
          { $addToSet: { assignedSubjects: subject._id, assignedClasses: subject.classId } }
        );
      }
    }
    if (status === 'active' || status === 'archived') {
      subject.status = status;
    }

    await subject.save();

    const populated = await Subject.findById(subject._id)
      .populate('classId', 'name academicYear')
      .populate('teacherId', 'name email teacherId')
      .lean();

    res.json({ message: 'Subject updated successfully.', subject: populated });
  } catch (err) {
    next(err);
  }
}

export async function deleteSubject(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid subject ID.', 400);
    }

    const subject = await Subject.findById(id);
    if (!subject) {
      throw new AppError('Subject not found.', 404);
    }

    const [hasExams, hasQuestions] = await Promise.all([
      Exam.exists({ subjectId: subject._id }),
      Question.exists({ subjectId: subject._id }),
    ]);

    if (hasExams || hasQuestions) {
      subject.status = 'archived';
      await subject.save();
      res.json({
        message: 'Subject has linked questions or examinations and was archived instead of permanently deleted.',
        archived: true,
      });
      return;
    }

    await Subject.deleteOne({ _id: subject._id });
    res.json({ message: 'Subject deleted successfully.', archived: false });
  } catch (err) {
    next(err);
  }
}
