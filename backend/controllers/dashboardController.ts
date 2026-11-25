import type { NextFunction, Response } from 'express';
import { User } from '../models/User.ts';
import { ClassModel } from '../models/Class.ts';
import { Subject } from '../models/Subject.ts';
import { Exam } from '../models/Exam.ts';
import { Question } from '../models/Question.ts';
import { ExamAttempt } from '../models/ExamAttempt.ts';
import { Result } from '../models/Result.ts';
import { DEFAULT_GRADING_SCALE, Settings } from '../models/Settings.ts';
import { AppError } from '../middleware/errorHandler.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { escapeRegex } from '../utils/idGenerator.ts';
import { asCleanString } from '../validators/input.ts';
import { ensureDefaultSettings } from '../services/seedService.ts';

export async function getDashboardStats(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    if (req.user.role === 'admin') {
      const [
        totalStudents,
        totalTeachers,
        totalClasses,
        totalSubjects,
        totalExams,
        activeExams,
        completedExams,
        totalSubmissions,
        recentExams,
        recentStudents,
        recentSubmissions,
        allResults,
        classes,
      ] = await Promise.all([
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'teacher' }),
        ClassModel.countDocuments({ status: 'active' }),
        Subject.countDocuments({ status: 'active' }),
        Exam.countDocuments({ status: { $ne: 'archived' } }),
        Exam.countDocuments({ status: { $in: ['active', 'published'] } }),
        Exam.countDocuments({ status: 'completed' }),
        ExamAttempt.countDocuments({ status: { $in: ['submitted', 'graded'] } }),
        Exam.find({ status: { $ne: 'archived' } })
          .populate('subjectId', 'name code')
          .populate('classId', 'name')
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        User.find({ role: 'student' })
          .populate('classId', 'name')
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        ExamAttempt.find({ status: { $in: ['submitted', 'graded'] } })
          .populate('studentId', 'name studentId')
          .populate('examId', 'title')
          .sort({ submittedAt: -1 })
          .limit(6)
          .lean(),
        Result.find().populate('examId', 'title subjectId').lean(),
        ClassModel.find({ status: 'active' }).lean(),
      ]);

      const enrollmentChart = await Promise.all(
        classes.map(async (cls) => ({
          name: cls.name.split('—')[0].trim().slice(0, 18),
          students: await User.countDocuments({ role: 'student', classId: cls._id }),
          subjects: await Subject.countDocuments({ classId: cls._id }),
        }))
      );

      const gradeCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
      let passedCount = 0;
      for (const r of allResults) {
        if (gradeCounts[r.grade] !== undefined) gradeCounts[r.grade]++;
        if (r.passed) passedCount++;
      }

      const performanceChart = Object.entries(gradeCounts).map(([grade, count]) => ({
        grade: `Grade ${grade}`,
        count,
      }));

      const examStatusChart = [
        { name: 'Active', value: activeExams },
        { name: 'Scheduled', value: await Exam.countDocuments({ status: 'scheduled' }) },
        { name: 'Completed', value: completedExams },
        { name: 'Draft', value: await Exam.countDocuments({ status: 'draft' }) },
      ];

      const passRate = allResults.length > 0 ? Math.round((passedCount / allResults.length) * 100) : 0;

      res.json({
        role: 'admin',
        metrics: {
          totalStudents,
          totalTeachers,
          totalClasses,
          totalSubjects,
          totalExams,
          activeExams,
          completedExams,
          totalSubmissions,
          passRate,
        },
        charts: {
          enrollmentChart,
          performanceChart,
          examStatusChart,
        },
        recent: {
          recentExams,
          recentStudents,
          recentSubmissions,
        },
      });
      return;
    }

    if (req.user.role === 'teacher') {
      const ownedSubjects = await Subject.find({
        $or: [{ teacherId: req.user._id }, { _id: { $in: req.user.assignedSubjects || [] } }],
      }).lean();
      const subjectIds = ownedSubjects.map((s) => s._id);
      const classIds = [
        ...new Set([
          ...(req.user.assignedClasses || []).map(String),
          ...ownedSubjects.map((s) => String(s.classId)),
        ]),
      ];

      const teacherExams = await Exam.find({
        $or: [{ teacherId: req.user._id }, { subjectId: { $in: subjectIds } }],
        status: { $ne: 'archived' },
      })
        .populate('subjectId', 'name code')
        .populate('classId', 'name')
        .sort({ startDate: -1 })
        .lean();

      const examIds = teacherExams.map((e) => e._id);
      const [totalStudents, pendingGrading, results, recentSubmissions] = await Promise.all([
        User.countDocuments({ role: 'student', classId: { $in: classIds } }),
        Result.countDocuments({ examId: { $in: examIds }, gradingStatus: 'pending' }),
        Result.find({ examId: { $in: examIds } })
          .populate('examId', 'title subjectId')
          .lean(),
        ExamAttempt.find({ examId: { $in: examIds }, status: { $in: ['submitted', 'graded'] } })
          .populate('studentId', 'name studentId')
          .populate('examId', 'title')
          .sort({ submittedAt: -1 })
          .limit(6)
          .lean(),
      ]);

      const now = new Date();
      const upcomingExams = teacherExams.filter(
        (e) => ['scheduled', 'published', 'active'].includes(e.status) && new Date(e.endDate) >= now
      ).length;
      const completedExams = teacherExams.filter((e) => e.status === 'completed').length;

      const subjectPerfMap = new Map<string, { name: string; totalPct: number; count: number }>();
      for (const r of results) {
        const ex = r.examId as { title?: string } | null;
        const label = (ex?.title || 'Exam').slice(0, 20);
        const cur = subjectPerfMap.get(label) || { name: label, totalPct: 0, count: 0 };
        cur.totalPct += r.percentage;
        cur.count += 1;
        subjectPerfMap.set(label, cur);
      }

      const performanceByExam = Array.from(subjectPerfMap.values()).map((item) => ({
        name: item.name,
        avgScore: Math.round((item.totalPct / item.count) * 10) / 10,
        submissions: item.count,
      }));

      res.json({
        role: 'teacher',
        metrics: {
          assignedClasses: classIds.length,
          totalStudents,
          totalExams: teacherExams.length,
          upcomingExams,
          completedExams,
          pendingGrading,
        },
        charts: {
          performanceByExam,
        },
        recent: {
          recentExams: teacherExams.slice(0, 5),
          recentSubmissions,
        },
      });
      return;
    }

    // Student Dashboard
    const examQuery: Record<string, unknown> = {
      status: { $in: ['scheduled', 'published', 'active', 'completed'] },
    };
    if (req.user.classId) {
      examQuery.classId = req.user.classId;
    }

    const [classExams, myAttempts, publishedResults] = await Promise.all([
      Exam.find(examQuery)
        .populate('subjectId', 'name code')
        .populate('classId', 'name')
        .sort({ startDate: 1 })
        .lean(),
      ExamAttempt.find({ studentId: req.user._id }).lean(),
      Result.find({ studentId: req.user._id, published: true })
        .populate({
          path: 'examId',
          select: 'title subjectId startDate',
          populate: { path: 'subjectId', select: 'name code' },
        })
        .sort({ publishedAt: -1 })
        .lean(),
    ]);

    const now = new Date();
    const upcomingExams = classExams.filter((e) => new Date(e.endDate) >= now);
    const completedAttempts = myAttempts.filter((a) => ['submitted', 'graded'].includes(a.status));
    const avgScore =
      publishedResults.length > 0
        ? Math.round(
            (publishedResults.reduce((s, r) => s + r.percentage, 0) / publishedResults.length) * 10
          ) / 10
        : 0;

    const scoreTrend = [...publishedResults]
      .reverse()
      .map((r) => ({
        name: ((r.examId as { title?: string })?.title || 'Exam').slice(0, 16),
        percentage: r.percentage,
      }));

    res.json({
      role: 'student',
      metrics: {
        totalExams: classExams.length,
        upcomingExams: upcomingExams.length,
        completedExams: completedAttempts.length,
        averageScore: avgScore,
        publishedCount: publishedResults.length,
      },
      charts: {
        scoreTrend,
      },
      recent: {
        upcomingSchedule: upcomingExams.slice(0, 5),
        latestResults: publishedResults.slice(0, 5),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getReports(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);

    const examFilter = req.user.role === 'teacher' ? { teacherId: req.user._id } : {};
    const [exams, classes, subjects, results, students] = await Promise.all([
      Exam.find(examFilter)
        .populate('subjectId', 'name code')
        .populate('classId', 'name')
        .lean(),
      ClassModel.find({ status: 'active' }).lean(),
      Subject.find({ status: 'active' }).populate('classId', 'name').lean(),
      Result.find()
        .populate('studentId', 'name studentId classId')
        .populate('examId', 'title subjectId classId teacherId totalMarks')
        .lean(),
      User.find({ role: 'student' }).populate('classId', 'name').lean(),
    ]);

    const scopedResults =
      req.user.role === 'teacher'
        ? results.filter(
            (r) => String((r.examId as { teacherId?: unknown })?.teacherId) === req.user?._id.toString()
          )
        : results;

    const examResultsReport = exams.map((exam) => {
      const exResults = scopedResults.filter(
        (r) => String((r.examId as { _id?: unknown })?._id) === exam._id.toString()
      );
      const count = exResults.length;
      const avgPct = count ? Math.round((exResults.reduce((s, r) => s + r.percentage, 0) / count) * 10) / 10 : 0;
      const passed = exResults.filter((r) => r.passed).length;
      return {
        examId: exam._id,
        title: exam.title,
        subject: (exam.subjectId as { name?: string })?.name || '-',
        className: (exam.classId as { name?: string })?.name || '-',
        submissions: count,
        averagePercentage: avgPct,
        passRate: count ? Math.round((passed / count) * 100) : 0,
        passedCount: passed,
        failedCount: count - passed,
      };
    });

    const studentPerfReport = students.map((stu) => {
      const stuResults = scopedResults.filter(
        (r) => String((r.studentId as { _id?: unknown })?._id) === stu._id.toString()
      );
      const count = stuResults.length;
      const avgPct = count ? Math.round((stuResults.reduce((s, r) => s + r.percentage, 0) / count) * 10) / 10 : 0;
      const passed = stuResults.filter((r) => r.passed).length;
      return {
        studentId: stu.studentId || '-',
        name: stu.name,
        className: (stu.classId as { name?: string })?.name || 'Unassigned',
        examsTaken: count,
        averagePercentage: avgPct,
        passed,
        failed: count - passed,
      };
    });

    const classPerfReport = classes.map((cls) => {
      const clsResults = scopedResults.filter(
        (r) => String((r.examId as { classId?: unknown })?.classId) === cls._id.toString()
      );
      const count = clsResults.length;
      const avgPct = count ? Math.round((clsResults.reduce((s, r) => s + r.percentage, 0) / count) * 10) / 10 : 0;
      const passed = clsResults.filter((r) => r.passed).length;
      return {
        className: cls.name,
        academicYear: cls.academicYear,
        submissions: count,
        averagePercentage: avgPct,
        passRate: count ? Math.round((passed / count) * 100) : 0,
      };
    });

    const subjectPerfReport = subjects.map((sub) => {
      const subResults = scopedResults.filter(
        (r) => String((r.examId as { subjectId?: unknown })?.subjectId) === sub._id.toString()
      );
      const count = subResults.length;
      const avgPct = count ? Math.round((subResults.reduce((s, r) => s + r.percentage, 0) / count) * 10) / 10 : 0;
      const passed = subResults.filter((r) => r.passed).length;
      return {
        code: sub.code,
        subjectName: sub.name,
        className: (sub.classId as { name?: string })?.name || '-',
        submissions: count,
        averagePercentage: avgPct,
        passRate: count ? Math.round((passed / count) * 100) : 0,
      };
    });

    const participationReport = await Promise.all(
      exams.map(async (exam) => {
        const eligibleCount = await User.countDocuments({
          role: 'student',
          classId: exam.classId,
          status: 'active',
        });
        const attemptedCount = await ExamAttempt.distinct('studentId', {
          examId: exam._id,
          status: { $in: ['submitted', 'graded'] },
        });
        return {
          title: exam.title,
          className: (exam.classId as { name?: string })?.name || '-',
          eligibleStudents: eligibleCount,
          participated: attemptedCount.length,
          participationRate: eligibleCount
            ? Math.round((attemptedCount.length / eligibleCount) * 100)
            : 0,
        };
      })
    );

    const totalPassed = scopedResults.filter((r) => r.passed).length;
    const totalFailed = scopedResults.length - totalPassed;

    res.json({
      examResultsReport,
      studentPerfReport,
      classPerfReport,
      subjectPerfReport,
      participationReport,
      passFailSummary: {
        total: scopedResults.length,
        passed: totalPassed,
        failed: totalFailed,
        passRate: scopedResults.length ? Math.round((totalPassed / scopedResults.length) * 100) : 0,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getSettings(
  _req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await ensureDefaultSettings();
    const settings = await Settings.findOne().lean();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await ensureDefaultSettings();
    const settings = await Settings.findOne();
    if (!settings) throw new AppError('Settings record not found.', 404);

    if (req.body.institutionName !== undefined) {
      settings.institutionName = asCleanString(req.body.institutionName, 140) || 'EXAMPRO Academy';
    }
    if (req.body.academicYear !== undefined) {
      settings.academicYear = asCleanString(req.body.academicYear, 40) || '2026-2027';
    }
    if (req.body.defaultExamDuration !== undefined) {
      settings.defaultExamDuration = Math.max(5, Number(req.body.defaultExamDuration || 60));
    }
    if (req.body.allowSelfRegistration !== undefined) {
      settings.allowSelfRegistration = Boolean(req.body.allowSelfRegistration);
    }
    if (Array.isArray(req.body.gradingScale) && req.body.gradingScale.length > 0) {
      settings.gradingScale = req.body.gradingScale.map((band: Record<string, unknown>) => ({
        grade: asCleanString(band.grade, 5) || 'A',
        minPercentage: Math.max(0, Math.min(100, Number(band.minPercentage || 0))),
        maxPercentage: Math.max(0, Math.min(100, Number(band.maxPercentage || 100))),
        label: asCleanString(band.label, 40) || '',
      }));
    } else if (!settings.gradingScale.length) {
      settings.gradingScale = DEFAULT_GRADING_SCALE;
    }

    await settings.save();
    res.json({ message: 'System settings saved successfully.', settings });
  } catch (err) {
    next(err);
  }
}

export async function globalSearch(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const q = asCleanString(req.query.q, 80);
    if (!q || q.length < 2) {
      res.json({ results: [] });
      return;
    }

    const regex = new RegExp(escapeRegex(q), 'i');
    const items: { id: string; title: string; subtitle: string; type: string; path: string }[] = [];

    const examFilter: Record<string, unknown> = { title: regex };
    if (req.user.role === 'student') {
      if (req.user.classId) examFilter.classId = req.user.classId;
      examFilter.status = { $in: ['scheduled', 'published', 'active', 'completed'] };
    } else if (req.user.role === 'teacher') {
      examFilter.teacherId = req.user._id;
    }

    const matchedExams = await Exam.find(examFilter).limit(5).lean();
    for (const ex of matchedExams) {
      items.push({
        id: ex._id.toString(),
        title: ex.title,
        subtitle: `Examination · ${ex.status}`,
        type: 'Exam',
        path: req.user.role === 'student' ? `/student/exams/${ex._id}/instructions` : `/exams/${ex._id}/edit`,
      });
    }

    if (req.user.role === 'admin' || req.user.role === 'teacher') {
      const matchedQuestions = await Question.find({ questionText: regex }).limit(4).lean();
      for (const ques of matchedQuestions) {
        items.push({
          id: ques._id.toString(),
          title: ques.questionText.slice(0, 70),
          subtitle: `Question · ${ques.questionType.replace('_', ' ')}`,
          type: 'Question',
          path: '/questions',
        });
      }
    }

    if (req.user.role === 'admin') {
      const matchedUsers = await User.find({
        $or: [{ name: regex }, { email: regex }, { studentId: regex }, { teacherId: regex }],
      })
        .limit(5)
        .lean();
      for (const u of matchedUsers) {
        items.push({
          id: u._id.toString(),
          title: u.name,
          subtitle: `${u.role} · ${u.email}`,
          type: 'User',
          path: u.role === 'teacher' ? '/teachers' : u.role === 'student' ? '/students' : '/users',
        });
      }
    }

    res.json({ results: items });
  } catch (err) {
    next(err);
  }
}

export async function getNotifications(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) throw new AppError('Authentication required.', 401);
    const items: { id: string; title: string; detail: string; path: string; time: string }[] = [];

    if (req.user.role === 'student') {
      const activeExams = await Exam.find({
        ...(req.user.classId ? { classId: req.user.classId } : {}),
        status: { $in: ['active', 'published'] },
        endDate: { $gte: new Date() },
      })
        .sort({ startDate: 1 })
        .limit(3)
        .lean();

      for (const ex of activeExams) {
        items.push({
          id: `exam-${ex._id}`,
          title: `Available Exam: ${ex.title}`,
          detail: `${ex.duration} min · ${ex.totalMarks} marks`,
          path: `/student/exams/${ex._id}/instructions`,
          time: new Date(ex.startDate).toLocaleDateString(),
        });
      }

      const publishedResults = await Result.find({
        studentId: req.user._id,
        published: true,
      })
        .populate('examId', 'title')
        .sort({ publishedAt: -1 })
        .limit(3)
        .lean();

      for (const r of publishedResults) {
        items.push({
          id: `res-${r._id}`,
          title: `Result Published: ${(r.examId as { title?: string })?.title || 'Exam'}`,
          detail: `Score ${r.marksObtained}/${r.totalMarks} (${r.grade})`,
          path: `/results`,
          time: r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : 'Recent',
        });
      }
    } else {
      const pendingResults = await Result.find({ gradingStatus: 'pending' })
        .populate('studentId', 'name')
        .populate('examId', 'title teacherId')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      for (const r of pendingResults) {
        const ex = r.examId as { title?: string; teacherId?: unknown } | null;
        if (req.user.role === 'teacher' && String(ex?.teacherId) !== req.user._id.toString()) {
          continue;
        }
        items.push({
          id: `grade-${r._id}`,
          title: `Pending Grading: ${(r.studentId as { name?: string })?.name || 'Student'}`,
          detail: ex?.title || 'Examination submission',
          path: `/results/${r._id}/grade`,
          time: new Date(r.createdAt).toLocaleDateString(),
        });
      }
    }

    res.json({ notifications: items });
  } catch (err) {
    next(err);
  }
}
