import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Clock, FileCheck, Play, ShieldAlert } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { StatusTag } from '../../components/StatusTag';
import type { ExamAttemptItem, ExamItem } from '../../types';

export function ExamInstructionsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [exam, setExam] = useState<ExamItem | null>(null);
  const [myAttempts, setMyAttempts] = useState<ExamAttemptItem[]>([]);
  const [serverNow, setServerNow] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<{ exam: ExamItem; myAttempts: ExamAttemptItem[]; serverNow: string }>(`/exams/${id}`)
      .then((res) => {
        setExam(res.data.exam);
        setMyAttempts(res.data.myAttempts || []);
        setServerNow(new Date(res.data.serverNow || Date.now()));
      })
      .catch((err) => {
        showToast(extractErrorMessage(err, 'Failed to load examination.'), 'error');
        navigate('/student/exams/available');
      })
      .finally(() => setLoading(false));
  }, [id, navigate, showToast]);

  const handleStart = async () => {
    if (!exam) return;
    setStarting(true);
    try {
      const { data } = await api.post<{ attempt: ExamAttemptItem }>(`/exams/${exam._id}/start`);
      navigate(`/student/attempt/${data.attempt._id}`);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Cannot start examination.'), 'error');
    } finally {
      setStarting(false);
    }
  };

  if (loading || !exam) {
    return <div className="p-8 text-sm text-slate-500">Loading examination instructions...</div>;
  }

  const start = new Date(exam.startDate);
  const end = new Date(exam.endDate);
  const inProgress = myAttempts.find((a) => a.status === 'in_progress');
  const attemptsUsed = myAttempts.length;
  const beforeStart = serverNow < start;
  const afterEnd = serverNow > end;
  const noAttemptsLeft = !inProgress && attemptsUsed >= exam.attemptsAllowed;
  const canStart = Boolean(inProgress) || (!beforeStart && !afterEnd && !noAttemptsLeft);

  return (
    <div className="max-w-3xl space-y-6">
      <button
        type="button"
        onClick={() => navigate('/student/exams/available')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Available Exams</span>
      </button>

      <div className="bg-white border border-slate-200 rounded-xl p-7 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <p className="text-xs font-medium text-indigo-600">
              {typeof exam.subjectId === 'object'
                ? `${exam.subjectId.code} · ${exam.subjectId.name}`
                : 'Subject'}
              {typeof exam.classId === 'object' ? ` · ${exam.classId.name}` : ''}
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-bold text-slate-900">
              {exam.title}
            </h1>
            {exam.description && (
              <p className="mt-2 text-sm text-slate-600">{exam.description}</p>
            )}
          </div>
          <StatusTag status={exam.status} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">Duration</span>
            <span className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
              {exam.duration} min
            </span>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">Questions</span>
            <span className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
              {exam.questionCount || 0}
            </span>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">Total / Pass</span>
            <span className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
              {exam.totalMarks} / {exam.passingMarks}
            </span>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">Attempts Used</span>
            <span className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums">
              {attemptsUsed} / {exam.attemptsAllowed}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-sm font-semibold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-indigo-600" />
            <span>Examination Instructions & Rules</span>
          </h2>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {exam.instructions}
          </div>
          <ul className="text-xs text-slate-600 space-y-1.5 pt-2 list-disc list-inside">
            <li>
              Examination window: <span className="font-mono">{start.toLocaleString()}</span> to{' '}
              <span className="font-mono">{end.toLocaleString()}</span>.
            </li>
            <li>
              Your countdown timer is synchronized with the server and begins immediately when you start.
            </li>
            <li>Answers save automatically as you navigate between questions.</li>
            <li>
              When the timer reaches <span className="font-mono">00:00</span>, your attempt is submitted automatically.
            </li>
          </ul>
        </div>

        {!canStart && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              {beforeStart && (
                <p>
                  This examination is scheduled to open on{' '}
                  <span className="font-mono font-semibold">{start.toLocaleString()}</span>.
                </p>
              )}
              {afterEnd && <p>The submission deadline for this examination has passed.</p>}
              {noAttemptsLeft && !beforeStart && !afterEnd && (
                <p>You have completed all {exam.attemptsAllowed} allowed attempt(s) for this exam.</p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Passing requirement: {exam.passingMarks} marks</span>
          </div>
          <button
            type="button"
            disabled={!canStart || starting}
            onClick={() =>
              inProgress ? navigate(`/student/attempt/${inProgress._id}`) : handleStart()
            }
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:pointer-events-none"
          >
            <Play className="w-4 h-4" />
            <span>
              {starting
                ? 'Preparing Examination...'
                : inProgress
                ? 'Resume Examination'
                : 'Start Examination'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
