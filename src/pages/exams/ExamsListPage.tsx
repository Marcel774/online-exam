import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, ClipboardList, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { StatusTag } from '../../components/StatusTag';
import { Pagination } from '../../components/Pagination';
import { EmptyState, TableSkeleton } from '../../components/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { ClassItem, ExamItem, ExamStatus, SubjectItem } from '../../types';

export function ExamsListPage() {
  const { showToast } = useToast();

  const [exams, setExams] = useState<ExamItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });

  const [deleteTarget, setDeleteTarget] = useState<ExamItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadExams = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{
        exams: ExamItem[];
        pagination: { total: number; page: number; pages: number };
      }>('/exams', {
        params: {
          search: search.trim() || undefined,
          subjectId: subjectFilter || undefined,
          classId: classFilter || undefined,
          status: statusFilter || undefined,
          sortBy: 'startDate',
          sortOrder,
          page,
          limit: 15,
        },
      });
      setExams(data.exams || []);
      setPagination(data.pagination);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load examinations.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [search, subjectFilter, classFilter, statusFilter, sortOrder, page, showToast]);

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  useEffect(() => {
    api
      .get<{ classes: ClassItem[] }>('/classes')
      .then((res) => setClasses(res.data.classes || []))
      .catch(() => {});
    api
      .get<{ subjects: SubjectItem[] }>('/subjects')
      .then((res) => setSubjects(res.data.subjects || []))
      .catch(() => {});
  }, []);

  const handleStatusChange = async (examId: string, nextStatus: ExamStatus) => {
    try {
      const { data } = await api.patch(`/exams/${examId}/status`, { status: nextStatus });
      showToast(data.message, 'success');
      loadExams();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update status.'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data } = await api.delete(`/exams/${deleteTarget._id}`);
      showToast(data.message, 'success');
      setDeleteTarget(null);
      loadExams();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete examination.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Examinations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Schedule assessments, configure question banks, and manage examination lifecycles.
          </p>
        </div>
        <Link
          to="/exams/create"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create Examination</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search examination title..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={subjectFilter}
          onChange={(e) => {
            setSubjectFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s._id} value={s._id}>
              {s.code} · {s.name}
            </option>
          ))}
        </select>
        <select
          value={classFilter}
          onChange={(e) => {
            setClassFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="">All Classes</option>
          {classes.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
          >
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
          <button
            type="button"
            onClick={() => setSortOrder((s) => (s === 'desc' ? 'asc' : 'desc'))}
            className="px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 whitespace-nowrap shrink-0"
            title="Sort by Start Date"
          >
            {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
          </button>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : exams.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No examinations found"
          description="Create a new examination, set its schedule, and attach questions from the bank."
          action={
            <Link
              to="/exams/create"
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              Create First Examination
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
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4 text-right">Duration</th>
                  <th className="py-3 px-4 text-right">Marks</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {exams.map((ex) => (
                  <tr key={ex._id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-slate-900">{ex.title}</p>
                      <p className="text-xs text-slate-500 capitalize mt-0.5">
                        {ex.examType} · {ex.questionCount || 0} questions ·{' '}
                        {ex.submissionCount || 0} submissions
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {typeof ex.subjectId === 'object' ? ex.subjectId?.code : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {typeof ex.classId === 'object' ? ex.classId?.name : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {new Date(ex.startDate).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-slate-700">
                      {ex.duration} min
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-xs tabular-nums text-slate-900">
                      {ex.totalMarks}
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={ex.status}
                        onChange={(e) => handleStatusChange(ex._id, e.target.value as ExamStatus)}
                        aria-label={`Change status for ${ex.title}`}
                        className="text-xs font-medium border border-slate-200 rounded-md px-2 py-1 bg-white"
                      >
                        <option value="draft">Draft</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="published">Published</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                      </select>
                      <div className="mt-1">
                        <StatusTag status={ex.status} />
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          to={`/results?examId=${ex._id}`}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-md"
                          title="View Results & Submissions"
                        >
                          <Award className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/exams/${ex._id}/edit`}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                          title="Edit Examination"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(ex)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                          title="Delete or Archive Examination"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete or Archive Examination"
        description={`Are you sure you want to remove "${deleteTarget?.title}"? Examinations with existing student submissions will be archived instead of permanently deleted to protect academic records.`}
        confirmLabel="Confirm"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
