import type { NextFunction, Response } from 'express';
import { Result } from '../models/Result.ts';
import { ExamAttempt } from '../models/ExamAttempt.ts';
import { Exam } from '../models/Exam.ts';
import { Question } from '../models/Question.ts';
import { Subject } from '../models/Subject.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { escapeRegex, isValidObjectId } from '../utils/idGenerator.ts';
import { asCleanString } from '../validators/input.ts';
import { getActiveGradingScale, resolveLetterGrade } from '../services/gradingService.ts';

async function getTeacherExamIds(user: AuthenticatedRequest['user']) {
  if (!user) return [];
  const ownedSubjects = await Subject.distinct('_id', { teacherId: user._id });
  const subjectPool = [...(user.assignedSubjects || []), ...ownedSubjects];
  return Exam.distinct('_id', {
    $or: [{ teacherId: user._id }, { subjectId: { $in: subjectPool } }],
  });
}

export async function getResults(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const examId = asCleanString(req.query.examId, 60);
    const gradingStatus = asCleanString(req.query.gradingStatus, 30);
    const published = asCleanString(req.query.published, 10);
    const search = asCleanString(req.query.search, 120);
    const sortBy = asCleanString(req.query.sortBy, 30) || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));

    const query: Record<string, unknown> = {};

    if (req.user.role === 'student') {
      query.studentId = req.user._id;
      query.published = true;
    } else if (req.user.role === 'teacher') {
      const teacherExamIds = await getTeacherExamIds(req.user);
      query.examId = { $in: teacherExamIds };
    }

    if (examId && isValidObjectId(examId)) {
      if (req.user.role === 'teacher') {
        const teacherExamIds = (await getTeacherExamIds(req.user)).map(String);
        if (!teacherExamIds.includes(examId)) {
          throw new AppError('You do not have access to results for this examination.', 403);
        }
      }
      query.examId = examId;
    }

    if (gradingStatus && ['pending', 'graded'].includes(gradingStatus)) {
      query.gradingStatus = gradingStatus;
    }

    if (req.user.role !== 'student' && (published === 'true' || published === 'false')) {
      query.published = published === 'true';
    }

    let results = await Result.find(query)
      .populate('studentId', 'name email studentId classId')
      .populate({
        path: 'examId',
        select: 'title examType totalMarks passingMarks subjectId classId startDate',
        populate: [
          { path: 'subjectId', select: 'name code' },
          { path: 'classId', select: 'name' },
        ],
      })
      .populate('attemptId', 'submittedAt attemptNumber status')
      .sort(
        sortBy === 'percentage'
          ? { percentage: sortOrder }
          : sortBy === 'marksObtained'
          ? { marksObtained: sortOrder }
          : { createdAt: sortOrder }
      )
      .lean();

    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      results = results.filter((r) => {
        const stu = r.studentId as { name?: string; studentId?: string; email?: string } | null;
        const ex = r.examId as { title?: string } | null;
        return (
          regex.test(stu?.name || '') ||
          regex.test(stu?.studentId || '') ||
          regex.test(stu?.email || '') ||
          regex.test(ex?.title || '')
        );
      });
    }

    const total = results.length;
    const paged = results.slice((page - 1) * limit, page * limit);

    res.json({
      results: paged,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

export async function getExamResults(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    req.query.examId = String(req.params.id || '');
    await getResults(req, res, next);
  } catch (err) {
    next(err);
  }
}

export async function getResultById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) throw new AppError('Invalid result ID.', 400);

    const result = await Result.findById(id)
      .populate('studentId', 'name email studentId')
      .populate({
        path: 'examId',
        select: 'title description examType totalMarks passingMarks subjectId classId startDate endDate',
        populate: [
          { path: 'subjectId', select: 'name code' },
          { path: 'classId', select: 'name academicYear' },
        ],
      })
      .lean();

    if (!result) throw new AppError('Result record not found.', 404);

    if (req.user.role === 'student') {
      if (String((result.studentId as { _id?: unknown })._id || result.studentId) !== req.user._id.toString()) {
        throw new AppError('You cannot view another student’s result.', 403);
      }
      if (!result.published) {
        throw new AppError('This examination result has not been published yet.', 403);
      }
    }

    const attempt = await ExamAttempt.findById(result.attemptId).lean();
    if (!attempt) throw new AppError('Attempt record not found.', 404);

    const questions = await Question.find({
      _id: { $in: attempt.assignedQuestionIds },
    }).lean();
    const qMap = new Map(questions.map((q) => [q._id.toString(), q]));

    const breakdown = attempt.answers.map((ans) => {
      const q = qMap.get(ans.questionId.toString());
      return {
        questionId: ans.questionId,
        questionText: q?.questionText || 'Question removed',
        questionType: q?.questionType || 'mcq',
        options: q?.options || [],
        correctAnswer: q?.correctAnswer || '',
        expectedAnswer: q?.expectedAnswer || '',
        explanation: q?.explanation || '',
        maxMarks: q?.marks || 0,
        studentAnswer: ans.answer,
        marksAwarded: ans.marksAwarded,
        isCorrect: ans.isCorrect,
        graded: ans.graded,
        teacherFeedback: ans.teacherFeedback,
      };
    });

    res.json({ result, attempt, breakdown });
  } catch (err) {
    next(err);
  }
}

export async function gradeResult(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) throw new AppError('Invalid result ID.', 400);

    const result = await Result.findById(id);
    if (!result) throw new AppError('Result not found.', 404);

    const exam = await Exam.findById(result.examId);
    if (!exam) throw new AppError('Exam not found.', 404);

    if (req.user.role === 'teacher') {
      const teacherExamIds = (await getTeacherExamIds(req.user)).map(String);
      if (!teacherExamIds.includes(exam._id.toString())) {
        throw new AppError('You do not have permission to grade this examination.', 403);
      }
    }

    const attempt = await ExamAttempt.findById(result.attemptId);
    if (!attempt) throw new AppError('Attempt not found.', 404);

    const questions = await Question.find({ _id: { $in: attempt.assignedQuestionIds } }).lean();
    const qMap = new Map(questions.map((q) => [q._id.toString(), q]));

    const gradesInput = Array.isArray(req.body.questionGrades) ? req.body.questionGrades : [];
    const gradeMap = new Map<string, { marksAwarded: number; teacherFeedback: string }>();

    for (const g of gradesInput) {
      if (g && isValidObjectId(g.questionId)) {
        gradeMap.set(String(g.questionId), {
          marksAwarded: Number(g.marksAwarded || 0),
          teacherFeedback: asCleanString(g.teacherFeedback, 1000),
        });
      }
    }

    let totalObtained = 0;
    let totalMax = 0;
    let allGraded = true;

    attempt.answers = attempt.answers.map((ans) => {
      const q = qMap.get(ans.questionId.toString());
      const maxMarks = q?.marks || 0;
      totalMax += maxMarks;

      const patch = gradeMap.get(ans.questionId.toString());
      if (patch) {
        const clamped = Math.max(0, Math.min(maxMarks, patch.marksAwarded));
        totalObtained += clamped;
        return {
          ...ans,
          marksAwarded: clamped,
          isCorrect: clamped >= maxMarks * 0.5,
          graded: true,
          teacherFeedback: patch.teacherFeedback,
        };
      }

      if (!ans.graded) allGraded = false;
      totalObtained += ans.marksAwarded || 0;
      return ans;
    });

    const effectiveTotal = totalMax > 0 ? totalMax : attempt.totalMarks;
    const percentage = effectiveTotal > 0 ? Math.round((totalObtained / effectiveTotal) * 1000) / 10 : 0;
    const scale = await getActiveGradingScale();
    const grade = resolveLetterGrade(percentage, scale);
    const passingRatio = exam.totalMarks > 0 ? exam.passingMarks / exam.totalMarks : 0.5;
    const passed = totalObtained >= effectiveTotal * passingRatio;

    attempt.score = Math.round(totalObtained * 100) / 100;
    attempt.totalMarks = effectiveTotal;
    attempt.percentage = percentage;
    attempt.grade = grade;
    attempt.passed = passed;
    attempt.status = allGraded ? 'graded' : 'submitted';
    await attempt.save();

    result.marksObtained = attempt.score;
    result.totalMarks = effectiveTotal;
    result.percentage = percentage;
    result.grade = grade;
    result.passed = passed;
    result.gradingStatus = allGraded ? 'graded' : 'pending';
    if (req.body.feedback !== undefined) {
      result.feedback = asCleanString(req.body.feedback, 2000);
    }
    if (req.body.publish === true) {
      result.published = true;
      result.publishedAt = new Date();
    }
    await result.save();

    res.json({
      message: 'Grades saved successfully.',
      result,
    });
  } catch (err) {
    next(err);
  }
}

export async function publishResult(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) throw new AppError('Invalid result ID.', 400);

    const result = await Result.findById(id);
    if (!result) throw new AppError('Result not found.', 404);

    if (req.user.role === 'teacher') {
      const teacherExamIds = (await getTeacherExamIds(req.user)).map(String);
      if (!teacherExamIds.includes(result.examId.toString())) {
        throw new AppError('You do not have permission to publish this result.', 403);
      }
    }

    const publishFlag = req.body.published !== undefined ? Boolean(req.body.published) : true;
    result.published = publishFlag;
    result.publishedAt = publishFlag ? new Date() : undefined;
    await result.save();

    res.json({
      message: publishFlag ? 'Result published to student.' : 'Result unpublished.',
      result,
    });
  } catch (err) {
    next(err);
  }
}

export async function publishExamResultsBulk(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const examId = String(req.params.id || '');
    if (!isValidObjectId(examId)) throw new AppError('Invalid examination ID.', 400);

    if (req.user.role === 'teacher') {
      const teacherExamIds = (await getTeacherExamIds(req.user)).map(String);
      if (!teacherExamIds.includes(examId)) {
        throw new AppError('You do not have permission to publish results for this exam.', 403);
      }
    }

    const updated = await Result.updateMany(
      { examId, gradingStatus: 'graded' },
      { $set: { published: true, publishedAt: new Date() } }
    );

    res.json({
      message: `Published ${updated.modifiedCount} graded result(s) for this examination.`,
      modifiedCount: updated.modifiedCount,
    });
  } catch (err) {
    next(err);
  }
}
