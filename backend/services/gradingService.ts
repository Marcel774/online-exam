import { DEFAULT_GRADING_SCALE, Settings } from '../models/Settings.ts';
import type { IGradingScaleBand } from '../models/Settings.ts';
import type { IExamAttempt } from '../models/ExamAttempt.ts';
import type { IExam } from '../models/Exam.ts';
import type { IQuestion } from '../models/Question.ts';

export async function getActiveGradingScale(): Promise<IGradingScaleBand[]> {
  const settings = await Settings.findOne().lean();
  if (settings && Array.isArray(settings.gradingScale) && settings.gradingScale.length > 0) {
    return settings.gradingScale;
  }
  return DEFAULT_GRADING_SCALE;
}

export function resolveLetterGrade(percentage: number, scale: IGradingScaleBand[]): string {
  const sorted = [...scale].sort((a, b) => b.minPercentage - a.minPercentage);
  const rounded = Math.round(percentage);
  for (const band of sorted) {
    if (rounded >= band.minPercentage && rounded <= band.maxPercentage) {
      return band.grade;
    }
  }
  for (const band of sorted) {
    if (percentage >= band.minPercentage) {
      return band.grade;
    }
  }
  return 'F';
}

export async function gradeAttemptObjectiveAndComputeTotals(
  attempt: IExamAttempt,
  exam: IExam,
  questionsById: Map<string, IQuestion>
): Promise<{
  score: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  passed: boolean;
  allGraded: boolean;
}> {
  let score = 0;
  let totalMarks = 0;
  let allGraded = true;

  const answerMap = new Map(
    attempt.answers.map((entry) => [entry.questionId.toString(), entry])
  );

  const updatedAnswers = attempt.assignedQuestionIds.map((qId) => {
    const key = qId.toString();
    const question = questionsById.get(key);
    const existing = answerMap.get(key);
    const maxMarks = question ? question.marks : 0;
    totalMarks += maxMarks;

    const studentAnswer = existing?.answer || '';

    if (!question) {
      return {
        questionId: qId,
        answer: studentAnswer,
        flagged: existing?.flagged || false,
        savedAt: existing?.savedAt || new Date(),
        marksAwarded: existing?.marksAwarded || 0,
        isCorrect: existing?.isCorrect || false,
        graded: true,
        teacherFeedback: existing?.teacherFeedback || '',
      };
    }

    if (question.questionType === 'mcq' || question.questionType === 'true_false') {
      const normalizedStudent = studentAnswer.trim().toLowerCase();
      const normalizedCorrect = (question.correctAnswer || '').trim().toLowerCase();
      const isCorrect = normalizedStudent !== '' && normalizedStudent === normalizedCorrect;
      const marksAwarded = isCorrect ? question.marks : 0;
      score += marksAwarded;

      return {
        questionId: qId,
        answer: studentAnswer,
        flagged: existing?.flagged || false,
        savedAt: existing?.savedAt || new Date(),
        marksAwarded,
        isCorrect,
        graded: true,
        teacherFeedback: existing?.teacherFeedback || '',
      };
    }

    // Subjective question (short_answer / essay)
    const alreadyGraded = Boolean(existing?.graded);
    if (!alreadyGraded) {
      allGraded = false;
    }
    const marksAwarded = alreadyGraded ? Math.min(existing?.marksAwarded || 0, question.marks) : 0;
    score += marksAwarded;

    return {
      questionId: qId,
      answer: studentAnswer,
      flagged: existing?.flagged || false,
      savedAt: existing?.savedAt || new Date(),
      marksAwarded,
      isCorrect: marksAwarded >= question.marks * 0.5,
      graded: alreadyGraded,
      teacherFeedback: existing?.teacherFeedback || '',
    };
  });

  attempt.answers = updatedAnswers;
  const effectiveTotal = totalMarks > 0 ? totalMarks : exam.totalMarks;
  const percentage = effectiveTotal > 0 ? Math.round((score / effectiveTotal) * 1000) / 10 : 0;
  const scale = await getActiveGradingScale();
  const grade = resolveLetterGrade(percentage, scale);
  const passingRatio = exam.totalMarks > 0 ? exam.passingMarks / exam.totalMarks : 0.5;
  const effectivePassingMarks = effectiveTotal * passingRatio;
  const passed = score >= effectivePassingMarks;

  attempt.score = Math.round(score * 100) / 100;
  attempt.totalMarks = effectiveTotal;
  attempt.percentage = percentage;
  attempt.grade = grade;
  attempt.passed = passed;
  attempt.status = allGraded ? 'graded' : 'submitted';

  return {
    score: attempt.score,
    totalMarks: effectiveTotal,
    percentage,
    grade,
    passed,
    allGraded,
  };
}
