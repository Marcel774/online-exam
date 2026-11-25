import type { NextFunction, Response } from 'express';
import { Exam } from '../models/Exam.ts';
import type { ExamStatus, ExamType } from '../models/Exam.ts';
import { Question } from '../models/Question.ts';
import { Subject } from '../models/Subject.ts';
import { ExamAttempt } from '../models/ExamAttempt.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { escapeRegex, isValidObjectId } from '../utils/idGenerator.ts';
import { asCleanString, asObjectIdArray, asPositiveNumber } from '../validators/input.ts';

export async function getExams(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const search = asCleanString(req.query.search, 120);
    const subjectId = asCleanString(req.query.subjectId, 60);
    const classId = asCleanString(req.query.classId, 60);
    const status = asCleanString(req.query.status, 30);
    const sortBy = asCleanString(req.query.sortBy, 30) || 'startDate';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const query: Record<string, unknown> = {};

    if (req.user?.role === 'teacher') {
      const ownedSubjects = await Subject.distinct('_id', { teacherId: req.user._id });
      const subjectPool = [...(req.user.assignedSubjects || []), ...ownedSubjects];
      query.$or = [
        { teacherId: req.user._id },
        { subjectId: { $in: subjectPool } },
      ];
    } else if (req.user?.role === 'student') {
      if (req.user.classId) {
        query.classId = req.user.classId;
      }
      query.status = { $in: ['scheduled', 'published', 'active', 'completed'] };
    }

    if (subjectId && isValidObjectId(subjectId)) query.subjectId = subjectId;
    if (classId && isValidObjectId(classId)) query.classId = classId;
    if (status && ['draft', 'scheduled', 'published', 'active', 'completed', 'archived'].includes(status)) {
      if (req.user?.role === 'student' && (status === 'draft' || status === 'archived')) {
        query.status = '__none__';
      } else {
        query.status = status;
      }
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$and = [
        ...(Array.isArray(query.$and) ? query.$and : []),
        { $or: [{ title: regex }, { description: regex }] },
      ];
    }

    const allowedSort: Record<string, Record<string, 1 | -1>> = {
      startDate: { startDate: sortOrder },
      createdAt: { createdAt: sortOrder },
      title: { title: sortOrder },
      totalMarks: { totalMarks: sortOrder },
    };

    const total = await Exam.countDocuments(query);
    const exams = await Exam.find(query)
      .populate('subjectId', 'name code')
      .populate('classId', 'name academicYear')
      .populate('teacherId', 'name email')
      .sort(allowedSort[sortBy] || { startDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Enrich for student or teacher
    const examIds = exams.map((e) => e._id);
    if (req.user?.role === 'student') {
      const attempts = await ExamAttempt.find({
        studentId: req.user._id,
        examId: { $in: examIds },
      })
        .sort({ attemptNumber: -1 })
        .lean();

      const enriched = exams.map((exam) => {
        const myAttempts = attempts.filter((a) => a.examId.toString() === exam._id.toString());
        const inProgress = myAttempts.find((a) => a.status === 'in_progress');
        return {
          ...exam,
          questionCount: exam.randomSelection?.enabled
            ? exam.randomSelection.count
            : exam.questions?.length || 0,
          questions: undefined,
          myAttemptCount: myAttempts.length,
          inProgressAttemptId: inProgress?._id || null,
          latestAttemptStatus: myAttempts[0]?.status || null,
        };
      });

      res.json({
        exams: enriched,
        serverNow: new Date().toISOString(),
        pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
      });
      return;
    }

    const attemptCounts = await ExamAttempt.aggregate([
      { $match: { examId: { $in: examIds }, status: { $in: ['submitted', 'graded'] } } },
      { $group: { _id: '$examId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(attemptCounts.map((item) => [item._id.toString(), item.count]));

    const enriched = exams.map((exam) => ({
      ...exam,
      questionCount: exam.randomSelection?.enabled
        ? exam.randomSelection.count
        : exam.questions?.length || 0,
      submissionCount: countMap.get(exam._id.toString()) || 0,
    }));

    res.json({
      exams: enriched,
      serverNow: new Date().toISOString(),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

export async function getExamById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid examination ID.', 400);
    }

    const exam = await Exam.findById(id)
      .populate('subjectId', 'name code')
      .populate('classId', 'name academicYear')
      .populate('teacherId', 'name email')
      .populate(
        'questions',
        req.user?.role === 'student'
          ? 'questionText questionType options marks topic difficulty'
          : undefined
      )
      .lean();

    if (!exam) {
      throw new AppError('Examination not found.', 404);
    }

    if (req.user?.role === 'student') {
      if (exam.status === 'draft' || exam.status === 'archived') {
        throw new AppError('This examination is not available.', 403);
      }
      if (req.user.classId && exam.classId && String((exam.classId as { _id?: unknown })._id || exam.classId) !== req.user.classId.toString()) {
        throw new AppError('This examination is not assigned to your class.', 403);
      }

      const myAttempts = await ExamAttempt.find({
        studentId: req.user._id,
        examId: exam._id,
      })
        .sort({ attemptNumber: -1 })
        .lean();

      res.json({
        exam: {
          ...exam,
          questionCount: exam.randomSelection?.enabled
            ? exam.randomSelection.count
            : exam.questions?.length || 0,
          questions: [], // Do not leak questions before student clicks Start
        },
        myAttempts,
        serverNow: new Date().toISOString(),
      });
      return;
    }

    const submissionCount = await ExamAttempt.countDocuments({
      examId: exam._id,
      status: { $in: ['submitted', 'graded'] },
    });

    res.json({
      exam: { ...exam, submissionCount },
      serverNow: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function createExam(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const title = asCleanString(req.body.title, 200);
    const description = asCleanString(req.body.description, 2000);
    const subjectId = req.body.subjectId;
    const classId = req.body.classId;
    const examType = (asCleanString(req.body.examType, 20) || 'quiz') as ExamType;
    const startDate = new Date(req.body.startDate);
    const endDate = new Date(req.body.endDate);
    const duration = asPositiveNumber(req.body.duration, 60) || 60;
    const totalMarksInput = asPositiveNumber(req.body.totalMarks, 0) || 0;
    const passingMarks = asPositiveNumber(req.body.passingMarks, 0) || 0;
    const instructions = asCleanString(req.body.instructions, 3000);
    const attemptsAllowed = Math.max(1, asPositiveNumber(req.body.attemptsAllowed, 1) || 1);
    const status = (asCleanString(req.body.status, 20) || 'draft') as ExamStatus;
    const questionIds = asObjectIdArray(req.body.questions);
    const randomSelection = {
      enabled: Boolean(req.body.randomSelection?.enabled),
      count: Math.max(0, Number(req.body.randomSelection?.count || 0)),
      difficulty: asCleanString(req.body.randomSelection?.difficulty, 20) || 'all',
    };

    if (!title) throw new AppError('Examination title is required.', 400);
    if (!isValidObjectId(subjectId)) throw new AppError('Valid subject is required.', 400);
    if (!isValidObjectId(classId)) throw new AppError('Valid class is required.', 400);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new AppError('Valid start and end date/time are required.', 400);
    }
    if (endDate <= startDate) {
      throw new AppError('End date/time must be after the start date/time.', 400);
    }
    if (duration < 1) throw new AppError('Duration must be at least 1 minute.', 400);

    if (req.user.role === 'teacher') {
      const subjectDoc = await Subject.findById(subjectId).lean();
      const allowedSubjectIds = (req.user.assignedSubjects || []).map(String);
      if (
        !subjectDoc ||
        (subjectDoc.teacherId?.toString() !== req.user._id.toString() &&
          !allowedSubjectIds.includes(String(subjectId)))
      ) {
        throw new AppError('You can only create examinations for your assigned subjects.', 403);
      }
    }

    let computedMarks = totalMarksInput;
    if (randomSelection.enabled) {
      if (randomSelection.count < 1) {
        throw new AppError('Random question count must be at least 1.', 400);
      }
      const poolQuery: Record<string, unknown> = { subjectId };
      if (randomSelection.difficulty && randomSelection.difficulty !== 'all') {
        poolQuery.difficulty = randomSelection.difficulty;
      }
      const availablePool = await Question.find(poolQuery).lean();
      if (availablePool.length < randomSelection.count) {
        throw new AppError(
          `Only ${availablePool.length} matching question(s) exist in the bank, but ${randomSelection.count} were requested.`,
          400
        );
      }
      if (computedMarks <= 0) {
        computedMarks = availablePool
          .slice(0, randomSelection.count)
          .reduce((acc, q) => acc + q.marks, 0);
      }
    } else {
      if (questionIds.length === 0 && status !== 'draft') {
        throw new AppError('Select at least one question before publishing or scheduling an exam.', 400);
      }
      if (questionIds.length > 0 && computedMarks <= 0) {
        const qs = await Question.find({ _id: { $in: questionIds } }).lean();
        computedMarks = qs.reduce((acc, q) => acc + q.marks, 0);
      }
    }

    if (computedMarks <= 0) computedMarks = 100;
    if (passingMarks > computedMarks) {
      throw new AppError('Passing marks cannot exceed total marks.', 400);
    }

    const exam = await Exam.create({
      title,
      description,
      subjectId,
      classId,
      teacherId: req.user._id,
      examType,
      questions: randomSelection.enabled ? [] : questionIds,
      randomSelection,
      startDate,
      endDate,
      duration,
      totalMarks: computedMarks,
      passingMarks,
      instructions:
        instructions ||
        'Read every question carefully before answering. Your answers are saved automatically.',
      attemptsAllowed,
      status,
    });

    const populated = await Exam.findById(exam._id)
      .populate('subjectId', 'name code')
      .populate('classId', 'name academicYear')
      .populate('teacherId', 'name email')
      .lean();

    res.status(201).json({
      message: 'Examination created successfully.',
      exam: populated,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateExam(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) throw new AppError('Invalid examination ID.', 400);

    const exam = await Exam.findById(id);
    if (!exam) throw new AppError('Examination not found.', 404);

    if (req.user.role === 'teacher' && exam.teacherId.toString() !== req.user._id.toString()) {
      throw new AppError('You do not have permission to edit this examination.', 403);
    }

    const hasSubmissions = await ExamAttempt.exists({
      examId: exam._id,
      status: { $in: ['submitted', 'graded'] },
    });

    const title = asCleanString(req.body.title, 200);
    const description = asCleanString(req.body.description, 2000);
    const instructions = asCleanString(req.body.instructions, 3000);

    if (title) exam.title = title;
    if (req.body.description !== undefined) exam.description = description;
    if (req.body.instructions !== undefined) exam.instructions = instructions;

    if (req.body.startDate && req.body.endDate) {
      const startDate = new Date(req.body.startDate);
      const endDate = new Date(req.body.endDate);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {
        throw new AppError('End date/time must be after start date/time.', 400);
      }
      exam.startDate = startDate;
      exam.endDate = endDate;
    }

    if (req.body.status && ['draft', 'scheduled', 'published', 'active', 'completed', 'archived'].includes(req.body.status)) {
      exam.status = req.body.status;
    }

    if (!hasSubmissions) {
      if (isValidObjectId(req.body.subjectId)) {
        exam.subjectId = req.body.subjectId as unknown as typeof exam.subjectId;
      }
      if (isValidObjectId(req.body.classId)) {
        exam.classId = req.body.classId as unknown as typeof exam.classId;
      }
      if (req.body.examType) exam.examType = req.body.examType;
      if (req.body.duration) exam.duration = Math.max(1, Number(req.body.duration));
      if (req.body.attemptsAllowed) exam.attemptsAllowed = Math.max(1, Number(req.body.attemptsAllowed));

      if (req.body.randomSelection) {
        exam.randomSelection = {
          enabled: Boolean(req.body.randomSelection.enabled),
          count: Math.max(0, Number(req.body.randomSelection.count || 0)),
          difficulty: asCleanString(req.body.randomSelection.difficulty, 20) || 'all',
        };
      }
      if (Array.isArray(req.body.questions) && !exam.randomSelection.enabled) {
        exam.questions = asObjectIdArray(req.body.questions) as unknown as typeof exam.questions;
      }
      if (req.body.totalMarks !== undefined) {
        exam.totalMarks = Math.max(1, Number(req.body.totalMarks));
      }
      if (req.body.passingMarks !== undefined) {
        const pm = Math.max(0, Number(req.body.passingMarks));
        if (pm > exam.totalMarks) {
          throw new AppError('Passing marks cannot exceed total marks.', 400);
        }
        exam.passingMarks = pm;
      }
    }

    await exam.save();

    const populated = await Exam.findById(exam._id)
      .populate('subjectId', 'name code')
      .populate('classId', 'name academicYear')
      .populate('teacherId', 'name email')
      .lean();

    res.json({
      message: hasSubmissions
        ? 'Examination details updated (questions and marks locked due to existing student submissions).'
        : 'Examination updated successfully.',
      exam: populated,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateExamStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) throw new AppError('Invalid examination ID.', 400);

    const status = asCleanString(req.body.status, 20) as ExamStatus;
    if (!['draft', 'scheduled', 'published', 'active', 'completed', 'archived'].includes(status)) {
      throw new AppError('Invalid examination status.', 400);
    }

    const exam = await Exam.findById(id);
    if (!exam) throw new AppError('Examination not found.', 404);

    if (req.user.role === 'teacher' && exam.teacherId.toString() !== req.user._id.toString()) {
      throw new AppError('You do not have permission to update this examination.', 403);
    }

    exam.status = status;
    await exam.save();

    res.json({ message: `Examination status updated to ${status}.`, exam });
  } catch (err) {
    next(err);
  }
}

export async function deleteExam(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) throw new AppError('Invalid examination ID.', 400);

    const exam = await Exam.findById(id);
    if (!exam) throw new AppError('Examination not found.', 404);

    if (req.user.role === 'teacher' && exam.teacherId.toString() !== req.user._id.toString()) {
      throw new AppError('You do not have permission to delete this examination.', 403);
    }

    const hasAttempts = await ExamAttempt.exists({ examId: exam._id });
    if (hasAttempts) {
      exam.status = 'archived';
      await exam.save();
      res.json({
        message: 'Examination has student submissions and was archived to preserve academic records.',
        archived: true,
      });
      return;
    }

    await Exam.deleteOne({ _id: exam._id });
    res.json({ message: 'Examination deleted successfully.', archived: false });
  } catch (err) {
    next(err);
  }
}
