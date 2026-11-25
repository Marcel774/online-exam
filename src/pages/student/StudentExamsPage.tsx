import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, ClipboardList, Clock } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { StatusTag } from '../../components/StatusTag';
import { EmptyState, TableSkeleton } from '../../components/EmptyState';
import type { ExamItem } from '../../types';

export function StudentExamsPage({ mode }: { mode: 'available' | 'upcoming' }) {
  const { showToast } = useToast();
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [serverNow, setServerNow] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<{ exams: ExamItem[]; serverNow: string }>('/exams', { params: { limit: 50 } })
      .then((res) => {
        if (!active) return;
        const now = new Date(res.data.serverNow || Date.now());
        setServerNow(now);
        const list = res.data.exams || [];
        if (mode === 'available') {
          setExams(
            list.filter((e) => {
              const start = new Date(e.startDate);
              const end = new Date(e.endDate);
              return (
                ['active', 'published', 'scheduled'].includes(e.status) &&
                now >= start &&
                now <= end
              );
            })
          );
        } else {
          setExams(
            list.filter((e) => {
              const start = new Date(e.startDate);
              return ['scheduled', 'published', 'active'].includes(e.status) && start > now;
            })
          );
        }
      })
      .catch((err) => {
        if (active) showToast(extractErrorMessage(err, 'Failed to load examinations.'), 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, showToast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          {mode === 'available' ? 'Available Examinations' : 'Upcoming Examinations'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'available'
            ? 'Examinations currently open for your class cohort.'
            : 'Scheduled examinations opening at their designated start times.'}
        </p>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : exams.length === 0 ? (
        <EmptyState
          icon={mode === 'available' ? ClipboardList : CalendarClock}
          title={
            mode === 'available' ? 'No active examinations right now' : 'No upcoming examinations'
          }
          description={
            mode === 'available'
              ? 'Check Upcoming Exams for scheduled assessments or review past attempts in Exam History.'
              : 'Your instructors have not scheduled future examinations for your class yet.'
          }
          action={
            <Link
              to={mode === 'available' ? '/student/exams/upcoming' : '/student/exams/available'}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              {mode === 'available' ? 'View Upcoming Schedule' : 'Check Available Exams'}
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {exams.map((ex) => {
            const canResume = Boolean(ex.inProgressAttemptId);
            const used = ex.myAttemptCount || 0;
            const remainingAttempts = Math.max(0, ex.attemptsAllowed - used);
            const isOpen =
              mode === 'available' &&
              new Date(ex.startDate) <= serverNow &&
              new Date(ex.endDate) >= serverNow;

            return (
              <div
                key={ex._id}
                className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs text-slate-500 font-medium">
                      {typeof ex.subjectId === 'object' ? `${ex.subjectId.code} · ${ex.subjectId.name}` : ''}
                    </div>
                    <StatusTag status={ex.status} />
                  </div>
                  <h2 className="mt-2 font-display text-lg font-bold text-slate-900">
                    {ex.title}
                  </h2>
                  {ex.description && (
                    <p className="mt-1.5 text-sm text-slate-600 line-clamp-2">{ex.description}</p>
                  )}

                  <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500 block">Duration</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {ex.duration} min
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Total Marks</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {ex.totalMarks}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Attempts</span>
                      <span className="font-mono font-semibold text-slate-900 tabular-nums">
                        {used} / {ex.attemptsAllowed}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {mode === 'available'
                        ? `Closes ${new Date(ex.endDate).toLocaleString()}`
                        : `Opens ${new Date(ex.startDate).toLocaleString()}`}
                    </span>
                  </div>

                  {canResume ? (
                    <Link
                      to={`/student/attempt/${ex.inProgressAttemptId}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg whitespace-nowrap shrink-0"
                    >
                      <span>Resume Exam</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  ) : (
                    <Link
                      to={`/student/exams/${ex._id}/instructions`}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                        isOpen && remainingAttempts > 0
                          ? 'text-white bg-indigo-600 hover:bg-indigo-700'
                          : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                      }`}
                    >
                      <span>{isOpen && remainingAttempts > 0 ? 'Start Exam' : 'View Details'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
