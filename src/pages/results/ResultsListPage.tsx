import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Award, CheckCircle2, Download, Eye, Pencil, Search, Send } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusTag } from '../../components/StatusTag';
import { Pagination } from '../../components/Pagination';
import { EmptyState, TableSkeleton } from '../../components/EmptyState';
import type { ExamItem, ResultItem } from '../../types';

export function ResultsListPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const isStaff = user?.role === 'admin' || user?.role === 'teacher';

  const [results, setResults] = useState<ResultItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [examFilter, setExamFilter] = useState(searchParams.get('examId') || '');
  const [gradingFilter, setGradingFilter] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'percentage'>('createdAt');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [publishingExam, setPublishingExam] = useState(false);

  const loadResults = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{
        results: ResultItem[];
        pagination: { total: number; page: number; pages: number };
      }>('/results', {
        params: {
          search: search.trim() || undefined,
          examId: examFilter || undefined,
          gradingStatus: gradingFilter || undefined,
          sortBy,
          sortOrder: 'desc',
          page,
          limit: 15,
        },
      });
      setResults(data.results || []);
      setPagination(data.pagination);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load results.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [search, examFilter, gradingFilter, sortBy, page, showToast]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  useEffect(() => {
    if (isStaff) {
      api
        .get<{ exams: ExamItem[] }>('/exams', { params: { limit: 100 } })
        .then((res) => setExams(res.data.exams || []))
        .catch(() => {});
    }
  }, [isStaff]);

  const togglePublish = async (r: ResultItem) => {
    try {
      const { data } = await api.patch(`/results/${r._id}/publish`, {
        published: !r.published,
      });
      showToast(data.message, 'success');
      loadResults();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update publication status.'), 'error');
    }
  };

  const bulkPublishExam = async () => {
    if (!examFilter) return;
    setPublishingExam(true);
    try {
      const { data } = await api.patch(`/exams/${examFilter}/results/publish`);
      showToast(data.message, 'success');
      loadResults();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Bulk publish failed.'), 'error');
    } finally {
      setPublishingExam(false);
    }
  };

  const exportCsv = () => {
    const header = ['Student Name', 'Student ID', 'Examination', 'Obtained', 'Total', 'Percentage', 'Grade', 'Outcome', 'Published'];
    const rows = results.map((r) => {
      const stu = typeof r.studentId === 'object' ? r.studentId : null;
      const ex = typeof r.examId === 'object' ? r.examId : null;
      return [
        `"${stu?.name || '-'}"`,
        stu?.studentId || '-',
        `"${ex?.title || '-'}"`,
        r.marksObtained,
        r.totalMarks,
        `${r.percentage}%`,
        r.grade,
        r.passed ? 'Passed' : 'Failed',
        r.published ? 'Yes' : 'No',
      ].join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'exampro_results.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {isStaff ? 'Submissions & Results' : 'My Published Results'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isStaff
              ? 'Grade subjective responses, verify automated scores, and release results to students.'
              : 'Review your verified grades, percentages, and instructor feedback.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isStaff && examFilter && (
            <button
              type="button"
              onClick={bulkPublishExam}
              disabled={publishingExam}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              <Send className="w-4 h-4" />
              <span>{publishingExam ? 'Publishing...' : 'Publish All Graded'}</span>
            </button>
          )}
          {results.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search student or exam..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg"
          />
        </div>

        {isStaff && (
          <>
            <select
              value={examFilter}
              onChange={(e) => {
                setExamFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            >
              <option value="">All Examinations</option>
              {exams.map((ex) => (
                <option key={ex._id} value={ex._id}>
                  {ex.title}
                </option>
              ))}
            </select>

            <select
              value={gradingFilter}
              onChange={(e) => {
                setGradingFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            >
              <option value="">All Grading States</option>
              <option value="pending">Pending Grading</option>
              <option value="graded">Fully Graded</option>
            </select>
          </>
        )}

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'percentage')}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="createdAt">Sort: Most Recent</option>
          <option value="percentage">Sort: Highest Score</option>
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : results.length === 0 ? (
        <EmptyState
          icon={Award}
          title={isStaff ? 'No examination submissions yet' : 'No published results yet'}
          description={
            isStaff
              ? 'Student examination submissions will appear here for grading and release.'
              : 'Your grades will appear here as soon as your instructor publishes them.'
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  {isStaff && <th className="py-3 px-5">Student</th>}
                  <th className="py-3 px-4">Examination</th>
                  <th className="py-3 px-4 text-right">Marks</th>
                  <th className="py-3 px-4 text-right">Percentage</th>
                  <th className="py-3 px-4">Grade</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {results.map((r) => {
                  const stu = typeof r.studentId === 'object' ? r.studentId : null;
                  const ex = typeof r.examId === 'object' ? r.examId : null;

                  return (
                    <tr key={r._id} className="hover:bg-slate-50/80">
                      {isStaff && (
                        <td className="py-3.5 px-5">
                          <p className="font-semibold text-slate-900">{stu?.name || '-'}</p>
                          <p className="text-xs font-mono text-slate-500">
                            {stu?.studentId || stu?.email || ''}
                          </p>
                        </td>
                      )}
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-900">{ex?.title || '-'}</p>
                        <p className="text-xs text-slate-500">
                          {typeof ex?.subjectId === 'object' ? ex.subjectId.code : ''}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        {r.marksObtained} / {r.totalMarks}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900">
                        {r.percentage}%
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{r.grade}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusTag status={r.passed ? 'passed' : 'failed'} />
                          {isStaff && (
                            <>
                              <StatusTag status={r.gradingStatus} />
                              {r.published && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Published
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-2">
                          {isStaff ? (
                            <>
                              <Link
                                to={`/results/${r._id}/grade`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>{r.gradingStatus === 'pending' ? 'Grade' : 'Review'}</span>
                              </Link>
                              <button
                                type="button"
                                onClick={() => togglePublish(r)}
                                className={`px-2.5 py-1.5 text-xs font-semibold rounded-md border ${
                                  r.published
                                    ? 'text-slate-700 bg-white border-slate-300 hover:bg-slate-50'
                                    : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                {r.published ? 'Unpublish' : 'Publish'}
                              </button>
                            </>
                          ) : (
                            <Link
                              to={`/results/${r._id}`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Breakdown</span>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={pagination.page}
            pages={pagination.pages}
            total={pagination.total}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
