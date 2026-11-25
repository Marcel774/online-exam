import type { NextFunction, Response } from 'express';
import { Question } from '../models/Question.ts';
import type { DifficultyLevel, QuestionType } from '../models/Question.ts';
import { Subject } from '../models/Subject.ts';
import { Exam } from '../models/Exam.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { escapeRegex, isValidObjectId } from '../utils/idGenerator.ts';
import { asCleanString, asPositiveNumber } from '../validators/input.ts';

async function getTeacherAllowedSubjectIds(user: AuthenticatedRequest['user']) {
  if (!user) return [];
  const ownedSubjects = await Subject.distinct('_id', { teacherId: user._id });
  return [...new Set([...(user.assignedSubjects || []).map(String), ...ownedSubjects.map(String)])];
}

export async function getQuestions(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const search = asCleanString(req.query.search, 120);
    const subjectId = asCleanString(req.query.subjectId, 60);
    const topic = asCleanString(req.query.topic, 80);
    const difficulty = asCleanString(req.query.difficulty, 20);
    const questionType = asCleanString(req.query.questionType, 30);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 25)));

    const query: Record<string, unknown> = {};

    if (req.user?.role === 'teacher') {
      const allowedSubjectIds = await getTeacherAllowedSubjectIds(req.user);
      query.$or = [
        { teacherId: req.user._id },
        { subjectId: { $in: allowedSubjectIds } },
      ];
    }

    if (subjectId && isValidObjectId(subjectId)) {
      query.subjectId = subjectId;
    }
    if (topic) {
      query.topic = new RegExp(escapeRegex(topic), 'i');
    }
    if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
      query.difficulty = difficulty;
    }
    if (questionType && ['mcq', 'true_false', 'short_answer', 'essay'].includes(questionType)) {
      query.questionType = questionType;
    }
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$and = [
        ...(Array.isArray(query.$and) ? query.$and : []),
        { $or: [{ questionText: regex }, { topic: regex }] },
      ];
    }

    const total = await Question.countDocuments(query);
    const questions = await Question.find(query)
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      questions,
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

export async function getQuestionById(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid question ID.', 400);
    }

    const question = await Question.findById(id)
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name')
      .lean();

    if (!question) {
      throw new AppError('Question not found.', 404);
    }

    res.json({ question });
  } catch (err) {
    next(err);
  }
}

export async function createQuestion(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const questionText = asCleanString(req.body.questionText, 3000);
    const questionType = asCleanString(req.body.questionType, 30) as QuestionType;
    const subjectId = req.body.subjectId;
    const topic = asCleanString(req.body.topic, 100) || 'General';
    const difficulty = (asCleanString(req.body.difficulty, 20) || 'medium') as DifficultyLevel;
    const marks = asPositiveNumber(req.body.marks, 1) || 1;
    const explanation = asCleanString(req.body.explanation, 1500);
    const expectedAnswer = asCleanString(req.body.expectedAnswer, 2000);
    let correctAnswer = asCleanString(req.body.correctAnswer, 500);

    if (!questionText) {
      throw new AppError('Question text is required.', 400);
    }
    if (!['mcq', 'true_false', 'short_answer', 'essay'].includes(questionType)) {
      throw new AppError('Invalid question type.', 400);
    }
    if (!isValidObjectId(subjectId)) {
      throw new AppError('Please select a valid subject.', 400);
    }
    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      throw new AppError('Invalid difficulty level.', 400);
    }
    if (marks < 0.5) {
      throw new AppError('Marks must be at least 0.5.', 400);
    }

    if (req.user.role === 'teacher') {
      const allowedIds = await getTeacherAllowedSubjectIds(req.user);
      if (!allowedIds.includes(String(subjectId))) {
        throw new AppError('You can only create questions for your assigned subjects.', 403);
      }
    }

    let options: string[] = [];
    if (questionType === 'mcq') {
      options = Array.isArray(req.body.options)
        ? req.body.options.map((opt: unknown) => asCleanString(opt, 500)).filter(Boolean)
        : [];
      if (options.length < 4) {
        throw new AppError('Multiple choice questions require at least 4 answer options.', 400);
      }
      if (!correctAnswer || !options.includes(correctAnswer)) {
        throw new AppError('Correct answer must match one of the provided options.', 400);
      }
    } else if (questionType === 'true_false') {
      options = ['True', 'False'];
      if (!['True', 'False'].includes(correctAnswer)) {
        throw new AppError('True/False questions require "True" or "False" as the correct answer.', 400);
      }
    } else {
      correctAnswer = '';
    }

    const question = await Question.create({
      questionText,
      questionType,
      options,
      correctAnswer,
      expectedAnswer,
      marks,
      subjectId,
      topic,
      difficulty,
      explanation,
      teacherId: req.user._id,
    });

    const populated = await Question.findById(question._id)
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name')
      .lean();

    res.status(201).json({
      message: 'Question added to the question bank.',
      question: populated,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateQuestion(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid question ID.', 400);
    }

    const question = await Question.findById(id);
    if (!question) {
      throw new AppError('Question not found.', 404);
    }

    if (req.user.role === 'teacher') {
      const allowedIds = await getTeacherAllowedSubjectIds(req.user);
      if (
        question.teacherId.toString() !== req.user._id.toString() &&
        !allowedIds.includes(question.subjectId.toString())
      ) {
        throw new AppError('You do not have permission to edit this question.', 403);
      }
    }

    const questionText = asCleanString(req.body.questionText, 3000);
    const topic = asCleanString(req.body.topic, 100);
    const difficulty = asCleanString(req.body.difficulty, 20) as DifficultyLevel;
    const marks = asPositiveNumber(req.body.marks, question.marks);
    const explanation = asCleanString(req.body.explanation, 1500);
    const expectedAnswer = asCleanString(req.body.expectedAnswer, 2000);

    if (questionText) question.questionText = questionText;
    if (topic) question.topic = topic;
    if (difficulty && ['easy', 'medium', 'hard'].includes(difficulty)) {
      question.difficulty = difficulty;
    }
    if (marks && marks >= 0.5) question.marks = marks;
    if (req.body.explanation !== undefined) question.explanation = explanation;
    if (req.body.expectedAnswer !== undefined) question.expectedAnswer = expectedAnswer;
    if (isValidObjectId(req.body.subjectId)) {
      question.subjectId = req.body.subjectId as unknown as typeof question.subjectId;
    }

    if (question.questionType === 'mcq') {
      if (Array.isArray(req.body.options)) {
        const opts = req.body.options.map((o: unknown) => asCleanString(o, 500)).filter(Boolean);
        if (opts.length < 4) {
          throw new AppError('Multiple choice questions require at least 4 options.', 400);
        }
        question.options = opts;
      }
      if (req.body.correctAnswer !== undefined) {
        const ans = asCleanString(req.body.correctAnswer, 500);
        if (!question.options.includes(ans)) {
          throw new AppError('Correct answer must match one of the options.', 400);
        }
        question.correctAnswer = ans;
      }
    } else if (question.questionType === 'true_false' && req.body.correctAnswer !== undefined) {
      const ans = asCleanString(req.body.correctAnswer, 20);
      if (!['True', 'False'].includes(ans)) {
        throw new AppError('Correct answer must be True or False.', 400);
      }
      question.correctAnswer = ans;
    }

    await question.save();

    const populated = await Question.findById(question._id)
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name')
      .lean();

    res.json({ message: 'Question updated successfully.', question: populated });
  } catch (err) {
    next(err);
  }
}

export async function deleteQuestion(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const id = String(req.params.id || '');
    if (!isValidObjectId(id)) {
      throw new AppError('Invalid question ID.', 400);
    }

    const question = await Question.findById(id);
    if (!question) {
      throw new AppError('Question not found.', 404);
    }

    if (req.user.role === 'teacher' && question.teacherId.toString() !== req.user._id.toString()) {
      const allowedIds = await getTeacherAllowedSubjectIds(req.user);
      if (!allowedIds.includes(question.subjectId.toString())) {
        throw new AppError('You do not have permission to delete this question.', 403);
      }
    }

    const inUse = await Exam.exists({ questions: question._id });
    if (inUse) {
      throw new AppError('Cannot delete this question because it is attached to one or more examinations.', 409);
    }

    await Question.deleteOne({ _id: question._id });
    res.json({ message: 'Question deleted successfully.' });
  } catch (err) {
    next(err);
  }
}
