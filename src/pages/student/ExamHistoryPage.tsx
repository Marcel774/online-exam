import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { StatusTag } from '../../components/StatusTag';
import { EmptyState, TableSkeleton } from '../../components/EmptyState';

export function ExamHistoryPage() {
  const { showToast } = useToast();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get<{ attempts: any[] }>('/attempts/my')
      .then((res) => {
        if (active) setAttempts(res.data.attempts || []);
      })
      .catch((err) => {
        if (active) showToast(extractErrorMessage(err, 'Failed to load examination history.'), 'error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">Examination History</h1>
        <p className="mt-1 text-sm text-slate-500">
          Complete record of your examination attempts. Scores appear once results are published.
        </p>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : attempts.length === 0 ? (
        <EmptyState
          icon={History}
          title="No examination history yet"
          description="Your completed and in-progress examination attempts will appear here."
          action={
            <Link
              to="/student/exams/available"
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              Browse Available Exams
            </Link>
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-5">Examination</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Attempt</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Score / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {attempts.map((att) => (
                  <tr key={att._id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-5 font-semibold text-slate-900">
                      {att.examId?.title || 'Examination'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {att.examId?.subjectId?.code || '-'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs tabular-nums text-slate-700">
                      #{att.attemptNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600 tabular-nums">
                      {att.submittedAt ? new Date(att.submittedAt).toLocaleString() : 'In progress'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusTag status={att.status} />
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {att.status === 'in_progress' ? (
                        <Link
                          to={`/student/attempt/${att._id}`}
                          className="text-xs font-semibold text-amber-700 hover:text-amber-800"
                        >
                          Resume Attempt
                        </Link>
                      ) : att.resultPublished ? (
                        <Link
                          to={`/results/${att.resultId}`}
                          className="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-700 tabular-nums"
                        >
                          {att.score}/{att.totalMarks} ({att.grade}) · View Breakdown
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-500">Awaiting publication</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
