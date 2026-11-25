import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Save, Send, XCircle } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusTag } from '../../components/StatusTag';

interface BreakdownItem {
  questionId: string;
  questionText: string;
  questionType: 'mcq' | 'true_false' | 'short_answer' | 'essay';
  options: string[];
  correctAnswer: string;
  expectedAnswer: string;
  explanation: string;
  maxMarks: number;
  studentAnswer: string;
  marksAwarded: number;
  isCorrect: boolean;
  graded: boolean;
  teacherFeedback: string;
}

export function ResultDetailGradePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const isStaff = user?.role === 'admin' || user?.role === 'teacher';

  const [result, setResult] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);
  const [grades, setGrades] = useState<
    Record<string, { marksAwarded: number; teacherFeedback: string }>
  >({});
  const [overallFeedback, setOverallFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<{ result: any; breakdown: BreakdownItem[] }>(`/results/${id}`)
      .then((res) => {
        setResult(res.data.result);
        setBreakdown(res.data.breakdown || []);
        setOverallFeedback(res.data.result.feedback || '');

        const initGrades: Record<string, { marksAwarded: number; teacherFeedback: string }> = {};
        for (const item of res.data.breakdown || []) {
          initGrades[item.questionId] = {
            marksAwarded: item.marksAwarded,
            teacherFeedback: item.teacherFeedback || '',
          };
        }
        setGrades(initGrades);
      })
      .catch((err) => {
        showToast(extractErrorMessage(err, 'Unable to load result breakdown.'), 'error');
        navigate('/results');
      })
      .finally(() => setLoading(false));
  }, [id, navigate, showToast]);

  const handleSaveGrades = async (publishAfterSave = false) => {
    if (!id) return;
    setSaving(true);
    try {
      const payload = {
        questionGrades: breakdown.map((b) => ({
          questionId: b.questionId,
          marksAwarded: Number(grades[b.questionId]?.marksAwarded ?? b.marksAwarded),
          teacherFeedback: grades[b.questionId]?.teacherFeedback ?? b.teacherFeedback,
        })),
        feedback: overallFeedback,
        publish: publishAfterSave,
      };
      const { data } = await api.patch(`/results/${id}/grade`, payload);
      setResult((prev: any) => ({ ...prev, ...data.result }));
      showToast(
        publishAfterSave ? 'Grades saved and result published to student.' : 'Grades saved successfully.',
        'success'
      );
      if (publishAfterSave) {
        navigate('/results');
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save grades.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !result) {
    return <div className="p-8 text-sm text-slate-500">Loading submission breakdown...</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <button
        type="button"
        onClick={() => navigate('/results')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Results</span>
      </button>

      {/* Summary Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-indigo-600">
              {result.examId?.subjectId?.code} · {result.examId?.subjectId?.name}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900">
              {result.examId?.title}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Student: <span className="font-semibold text-slate-900">{result.studentId?.name}</span>{' '}
              {result.studentId?.studentId && (
                <span className="font-mono text-xs text-slate-500">
                  ({result.studentId.studentId})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusTag status={result.passed ? 'passed' : 'failed'} />
            {isStaff && <StatusTag status={result.gradingStatus} />}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <div>
            <span className="text-xs text-slate-500 block">Marks Obtained</span>
            <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
              {result.marksObtained} / {result.totalMarks}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Percentage</span>
            <span className="font-mono text-xl font-bold text-slate-900 tabular-nums">
              {result.percentage}%
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Letter Grade</span>
            <span className="font-display text-xl font-bold text-indigo-600">{result.grade}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Publication</span>
            <span className="text-sm font-semibold text-slate-900">
              {result.published ? 'Published to Student' : 'Unpublished Draft'}
            </span>
          </div>
        </div>
      </div>

      {/* Per-Question Breakdown */}
      <div className="space-y-4">
        {breakdown.map((item, idx) => {
          const isSubjective =
            item.questionType === 'short_answer' || item.questionType === 'essay';
          const currentMark = grades[item.questionId]?.marksAwarded ?? item.marksAwarded;
          const currentComment = grades[item.questionId]?.teacherFeedback ?? item.teacherFeedback;

          return (
            <div
              key={item.questionId}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-slate-500">
                  <span className="font-mono font-semibold text-slate-900 text-sm">
                    Q{idx + 1}
                  </span>
                  <span>·</span>
                  <span className="capitalize">{item.questionType.replace('_', ' ')}</span>
                  <span>·</span>
                  <span className="font-mono tabular-nums">Max {item.maxMarks} marks</span>
                </div>

                {item.graded ? (
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold font-mono tabular-nums ${
                      item.isCorrect ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {item.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {item.marksAwarded} / {item.maxMarks}
                  </span>
                ) : (
                  <StatusTag status="pending" />
                )}
              </div>

              <p className="text-sm sm:text-base font-medium text-slate-900">
                {item.questionText}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="block text-xs font-semibold text-slate-500 mb-1">
                    Student Response
                  </span>
                  <p className="text-slate-900 whitespace-pre-wrap">
                    {item.studentAnswer || <em className="text-slate-400">No answer provided</em>}
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200">
                  <span className="block text-xs font-semibold text-emerald-800 mb-1">
                    {isSubjective ? 'Expected Answer / Rubric' : 'Correct Answer'}
                  </span>
                  <p className="text-slate-900 whitespace-pre-wrap">
                    {isSubjective
                      ? item.expectedAnswer || 'Manual rubric evaluation'
                      : item.correctAnswer}
                  </p>
                </div>
              </div>

              {item.explanation && (
                <p className="text-xs text-slate-600 bg-slate-50 px-3.5 py-2.5 rounded-lg border border-slate-200">
                  <span className="font-semibold text-slate-800">Explanation: </span>
                  {item.explanation}
                </p>
              )}

              {isStaff ? (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Award Marks (0 – {item.maxMarks})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={item.maxMarks}
                      step={0.5}
                      value={currentMark}
                      onChange={(e) =>
                        setGrades((prev) => ({
                          ...prev,
                          [item.questionId]: {
                            marksAwarded: Number(e.target.value),
                            teacherFeedback: currentComment,
                          },
                        }))
                      }
                      className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Question Feedback (Optional)
                    </label>
                    <input
                      type="text"
                      value={currentComment}
                      onChange={(e) =>
                        setGrades((prev) => ({
                          ...prev,
                          [item.questionId]: {
                            marksAwarded: currentMark,
                            teacherFeedback: e.target.value,
                          },
                        }))
                      }
                      placeholder="Add constructive comment for this question..."
                      className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              ) : (
                item.teacherFeedback && (
                  <div className="text-xs text-indigo-900 bg-indigo-50 px-3.5 py-2.5 rounded-lg border border-indigo-200">
                    <span className="font-semibold">Instructor Feedback: </span>
                    {item.teacherFeedback}
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* Overall Feedback & Save Controls */}
      {isStaff ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1.5">
              Overall Examination Feedback
            </label>
            <textarea
              rows={3}
              value={overallFeedback}
              onChange={(e) => setOverallFeedback(e.target.value)}
              placeholder="Summarize strengths, areas to improve, and overall assessment notes..."
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveGrades(false)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>Save Draft Grades</span>
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSaveGrades(true)}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>Save & Publish Result</span>
            </button>
          </div>
        </div>
      ) : (
        result.feedback && (
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-sm font-semibold text-slate-900 mb-1.5">
              Overall Instructor Feedback
            </h2>
            <p className="text-sm text-slate-700 leading-relaxed">{result.feedback}</p>
          </div>
        )
      )}
    </div>
  );
}
