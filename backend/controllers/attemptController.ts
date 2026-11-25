import type { NextFunction, Response } from 'express';
import { Exam } from '../models/Exam.ts';
import { Question } from '../models/Question.ts';
import type { IQuestion } from '../models/Question.ts';
import { ExamAttempt } from '../models/ExamAttempt.ts';
import { Result } from '../models/Result.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { isValidObjectId } from '../utils/idGenerator.ts';
import { gradeAttemptObjectiveAndComputeTotals } from '../services/gradingService.ts';

async function finalizeAttempt(attemptId: string) {
  const claimed = await ExamAttempt.findOneAndUpdate(
    { _id: attemptId, status: 'in_progress' },
    { $set: { submittedAt: new Date() } },
    { new: true }
  );

  if (!claimed) {
    return null;
  }

  const exam = await Exam.findById(claimed.examId);
  if (!exam) {
    throw new AppError('Associated examination no longer exists.', 404);
  }

  const questions = await Question.find({
    _id: { $in: claimed.assignedQuestionIds },
  });
  const questionsById = new Map<string, IQuestion>(
    questions.map((q) => [q._id.toString(), q])
  );

  const summary = await gradeAttemptObjectiveAndComputeTotals(claimed, exam, questionsById);
  await claimed.save();

  const existingResult = await Result.findOne({ attemptId: claimed._id });
  if (!existingResult) {
    await Result.create({
      studentId: claimed.studentId,
      examId: claimed.examId,
      attemptId: claimed._id,
      marksObtained: summary.score,
      totalMarks: summary.totalMarks,
      percentage: summary.percentage,
      grade: summary.grade,
      passed: summary.passed,
      feedback: '',
      gradingStatus: summary.allGraded ? 'graded' : 'pending',
      published: false,
    });
  }

  return claimed;
}

function sanitizeQuestionsForStudent(questions: IQuestion[]) {
  return questions.map((q) => ({
    _id: q._id,
    questionText: q.questionText,
    questionType: q.questionType,
    options: q.options,
    marks: q.marks,
    topic: q.topic,
    difficulty: q.difficulty,
  }));
}

export async function startExamAttempt(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const examId = String(req.params.id || '');
    if (!isValidObjectId(examId)) throw new AppError('Invalid examination ID.', 400);

    const exam = await Exam.findById(examId)
      .populate('subjectId', 'name code')
      .populate('classId', 'name academicYear');
    if (!exam) throw new AppError('Examination not found.', 404);

    if (req.user.classId && exam.classId && String((exam.classId as { _id?: unknown })._id || exam.classId) !== req.user.classId.toString()) {
      throw new AppError('You are not enrolled in the class assigned to this examination.', 403);
    }

    if (!['active', 'published', 'scheduled'].includes(exam.status)) {
      throw new AppError('This examination is not open for attempts.', 403);
    }

    const now = new Date();
    if (now < exam.startDate) {
      throw new AppError(
        `This examination has not started yet. Scheduled start: ${exam.startDate.toISOString()}`,
        403
      );
    }
    if (now > exam.endDate) {
      throw new AppError('The deadline for this examination has passed.', 403);
    }

    // Check if student already has an in_progress attempt
    const inProgress = await ExamAttempt.findOne({
      studentId: req.user._id,
      examId: exam._id,
      status: 'in_progress',
    });

    if (inProgress) {
      if (now > inProgress.expiresAt) {
        await finalizeAttempt(inProgress._id.toString());
      } else {
        const questions: IQuestion[] = await Question.find({
          _id: { $in: inProgress.assignedQuestionIds },
        });
        const qMap = new Map(questions.map((q) => [q._id.toString(), q]));
        const orderedQuestions = inProgress.assignedQuestionIds
          .map((id) => qMap.get(id.toString()))
          .filter((q): q is IQuestion => Boolean(q));

        const remainingSeconds = Math.max(
          0,
          Math.floor((inProgress.expiresAt.getTime() - now.getTime()) / 1000)
        );

        res.json({
          attempt: inProgress,
          exam: {
            _id: exam._id,
            title: exam.title,
            description: exam.description,
            instructions: exam.instructions,
            subjectId: exam.subjectId,
            classId: exam.classId,
            duration: exam.duration,
            totalMarks: inProgress.totalMarks,
            passingMarks: exam.passingMarks,
          },
          questions: sanitizeQuestionsForStudent(orderedQuestions),
          serverNow: now.toISOString(),
          remainingSeconds,
        });
        return;
      }
    }

    const existingAttemptsCount = await ExamAttempt.countDocuments({
      studentId: req.user._id,
      examId: exam._id,
    });

    if (existingAttemptsCount >= exam.attemptsAllowed) {
      throw new AppError(
        `You have used all ${exam.attemptsAllowed} allowed attempt(s) for this examination.`,
        403
      );
    }

    // Resolve assigned questions
    let selectedQuestions: IQuestion[] = [];
    if (exam.randomSelection?.enabled && exam.randomSelection.count > 0) {
      const poolQuery: Record<string, unknown> = { subjectId: exam.subjectId };
      if (exam.randomSelection.difficulty && exam.randomSelection.difficulty !== 'all') {
        poolQuery.difficulty = exam.randomSelection.difficulty;
      }
      const pool = await Question.find(poolQuery);
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      selectedQuestions = shuffled.slice(0, exam.randomSelection.count);
    } else {
      const bankQuestions: IQuestion[] = await Question.find({ _id: { $in: exam.questions } });
      const qMap = new Map(bankQuestions.map((q) => [q._id.toString(), q]));
      selectedQuestions = exam.questions
        .map((qId) => qMap.get(qId.toString()))
        .filter((q): q is IQuestion => Boolean(q));
    }

    if (selectedQuestions.length === 0) {
      throw new AppError('This examination has no questions configured yet.', 400);
    }

    const totalMarks = selectedQuestions.reduce((sum, q) => sum + q.marks, 0) || exam.totalMarks;
    const durationLimit = new Date(now.getTime() + exam.duration * 60 * 1000);
    const expiresAt = durationLimit < exam.endDate ? durationLimit : exam.endDate;

    const attempt = await ExamAttempt.create({
      studentId: req.user._id,
      examId: exam._id,
      assignedQuestionIds: selectedQuestions.map((q) => q._id),
      answers: selectedQuestions.map((q) => ({
        questionId: q._id,
        answer: '',
        flagged: false,
        savedAt: now,
        marksAwarded: 0,
        isCorrect: false,
        graded: false,
        teacherFeedback: '',
      })),
      startedAt: now,
      expiresAt,
      totalMarks,
      status: 'in_progress',
      attemptNumber: existingAttemptsCount + 1,
    });

    const remainingSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
    );

    res.status(201).json({
      attempt,
      exam: {
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        instructions: exam.instructions,
        subjectId: exam.subjectId,
        classId: exam.classId,
        duration: exam.duration,
        totalMarks,
        passingMarks: exam.passingMarks,
      },
      questions: sanitizeQuestionsForStudent(selectedQuestions),
      serverNow: now.toISOString(),
      remainingSeconds,
    });
  } catch (err) {
    next(err);
  }
}

export async function getAttemptById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) throw new AppError('Invalid attempt ID.', 400);

    let attempt = await ExamAttempt.findById(id);
    if (!attempt) throw new AppError('Examination attempt not found.', 404);

    if (req.user.role === 'student' && attempt.studentId.toString() !== req.user._id.toString()) {
      throw new AppError('You do not have access to this examination attempt.', 403);
    }

    const now = new Date();
    if (attempt.status === 'in_progress' && now > attempt.expiresAt) {
      const finalized = await finalizeAttempt(attempt._id.toString());
      if (finalized) attempt = finalized;
    }

    const exam = await Exam.findById(attempt.examId)
      .populate('subjectId', 'name code')
      .populate('classId', 'name academicYear')
      .lean();

    const questions: IQuestion[] = await Question.find({
      _id: { $in: attempt.assignedQuestionIds },
    });
    const qMap = new Map(questions.map((q) => [q._id.toString(), q]));
    const orderedQuestions = attempt.assignedQuestionIds
      .map((qId) => qMap.get(qId.toString()))
      .filter((q): q is IQuestion => Boolean(q));

    const remainingSeconds =
      attempt.status === 'in_progress'
        ? Math.max(0, Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000))
        : 0;

    res.json({
      attempt,
      exam,
      questions:
        req.user.role === 'student'
          ? sanitizeQuestionsForStudent(orderedQuestions)
          : orderedQuestions,
      serverNow: now.toISOString(),
      remainingSeconds,
    });
  } catch (err) {
    next(err);
  }
}

export async function saveAttemptAnswers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) throw new AppError('Invalid attempt ID.', 400);

    const attempt = await ExamAttempt.findById(id);
    if (!attempt) throw new AppError('Examination attempt not found.', 404);

    if (attempt.studentId.toString() !== req.user._id.toString()) {
      throw new AppError('You cannot modify another student’s attempt.', 403);
    }

    if (attempt.status !== 'in_progress') {
      throw new AppError('This examination has already been submitted.', 409);
    }

    const now = new Date();
    // 15 second grace window for network latency
    if (now.getTime() > attempt.expiresAt.getTime() + 15000) {
      await finalizeAttempt(attempt._id.toString());
      throw new AppError('Examination time expired. Your answers have been automatically submitted.', 409);
    }

    const incoming = Array.isArray(req.body.answers) ? req.body.answers : [];
    const incomingMap = new Map<string, { answer: string; flagged: boolean }>();

    for (const item of incoming) {
      if (item && isValidObjectId(item.questionId)) {
        incomingMap.set(String(item.questionId), {
          answer: typeof item.answer === 'string' ? item.answer.slice(0, 10000) : '',
          flagged: Boolean(item.flagged),
        });
      }
    }

    attempt.answers = attempt.answers.map((existing) => {
      const patch = incomingMap.get(existing.questionId.toString());
      if (!patch) return existing;
      return {
        ...existing,
        answer: patch.answer,
        flagged: patch.flagged,
        savedAt: now,
      };
    });

    await attempt.save();

    res.json({
      savedAt: now.toISOString(),
      remainingSeconds: Math.max(0, Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000)),
    });
  } catch (err) {
    next(err);
  }
}

export async function submitAttempt(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) throw new AppError('Invalid attempt ID.', 400);

    const attempt = await ExamAttempt.findById(id);
    if (!attempt) throw new AppError('Examination attempt not found.', 404);

    if (attempt.studentId.toString() !== req.user._id.toString()) {
      throw new AppError('You cannot submit another student’s attempt.', 403);
    }

    if (attempt.status !== 'in_progress') {
      throw new AppError('This examination attempt has already been submitted.', 409);
    }

    // Apply any final answers sent in the submit payload
    if (Array.isArray(req.body.answers)) {
      const incomingMap = new Map<string, { answer: string; flagged: boolean }>();
      for (const item of req.body.answers) {
        if (item && isValidObjectId(item.questionId)) {
          incomingMap.set(String(item.questionId), {
            answer: typeof item.answer === 'string' ? item.answer.slice(0, 10000) : '',
            flagged: Boolean(item.flagged),
          });
        }
      }
      attempt.answers = attempt.answers.map((existing) => {
        const patch = incomingMap.get(existing.questionId.toString());
        if (!patch) return existing;
        return {
          ...existing,
          answer: patch.answer,
          flagged: patch.flagged,
          savedAt: new Date(),
        };
      });
      await attempt.save();
    }

    const finalized = await finalizeAttempt(attempt._id.toString());
    if (!finalized) {
      throw new AppError('Duplicate submission blocked: attempt already finalized.', 409);
    }

    res.json({
      message: 'Examination submitted successfully. Results will appear once released by your instructor.',
      attempt: {
        _id: finalized._id,
        status: finalized.status,
        submittedAt: finalized.submittedAt,
        attemptNumber: finalized.attemptNumber,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyAttempts(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const attempts = await ExamAttempt.find({ studentId: req.user._id })
      .populate({
        path: 'examId',
        select: 'title examType duration totalMarks passingMarks startDate endDate subjectId classId',
        populate: [
          { path: 'subjectId', select: 'name code' },
          { path: 'classId', select: 'name' },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();

    const attemptIds = attempts.map((a) => a._id);
    const publishedResults = await Result.find({
      attemptId: { $in: attemptIds },
      published: true,
    })
      .select('attemptId marksObtained totalMarks percentage grade passed published')
      .lean();

    const resultMap = new Map(publishedResults.map((r) => [r.attemptId.toString(), r]));

    // Do not expose unpublished scores to students
    const safeHistory = attempts.map((a) => {
      const pubResult = resultMap.get(a._id.toString());
      return {
        _id: a._id,
        examId: a.examId,
        attemptNumber: a.attemptNumber,
        startedAt: a.startedAt,
        submittedAt: a.submittedAt,
        status: a.status,
        totalMarks: a.totalMarks,
        resultPublished: Boolean(pubResult),
        resultId: pubResult?._id || null,
        score: pubResult ? pubResult.marksObtained : null,
        percentage: pubResult ? pubResult.percentage : null,
        grade: pubResult ? pubResult.grade : null,
        passed: pubResult ? pubResult.passed : null,
      };
    });

    res.json({ attempts: safeHistory });
  } catch (err) {
    next(err);
  }
}
