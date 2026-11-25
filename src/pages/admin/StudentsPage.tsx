import React, { useCallback, useEffect, useState } from 'react';
import {
  Download,
  History,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../../components/Avatar';
import { StatusTag } from '../../components/StatusTag';
import { Pagination } from '../../components/Pagination';
import { EmptyState, TableSkeleton } from '../../components/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { ClassItem, User } from '../../types';

export function StudentsPage() {
  const { showToast } = useToast();

  const [students, setStudents] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });

  // Add/Edit Student Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // CSV Import Modal
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvClassId, setCsvClassId] = useState('');
  const [importing, setImporting] = useState(false);

  // History Modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStudent, setHistoryStudent] = useState<User | null>(null);
  const [historyAttempts, setHistoryAttempts] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{
        users: User[];
        pagination: { total: number; page: number; pages: number };
      }>('/users', {
        params: {
          role: 'student',
          search: search.trim() || undefined,
          classId: classFilter || undefined,
          page,
          limit: 15,
        },
      });
      setStudents(data.users || []);
      setPagination(data.pagination);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load students.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [search, classFilter, page, showToast]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    api
      .get<{ classes: ClassItem[] }>('/classes')
      .then((res) => setClasses(res.data.classes || []))
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setEmail('');
    setPhone('');
    setClassId(classes[0]?._id || '');
    setStatus('active');
    setPassword('');
    setModalOpen(true);
  };

  const openEdit = (stu: User) => {
    setEditing(stu);
    setName(stu.name);
    setEmail(stu.email);
    setPhone(stu.phone || '');
    setClassId(typeof stu.classId === 'object' && stu.classId ? stu.classId._id : String(stu.classId || ''));
    setStatus(stu.status);
    setPassword('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast('Name and email are required.', 'error');
      return;
    }
    if (!editing && password.length < 6) {
      showToast('Initial password must be at least 6 characters.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        classId: classId || null,
        status,
        role: 'student',
      };
      if (password.length >= 6) payload.password = password;

      if (editing) {
        const { data } = await api.put(`/users/${editing._id}`, payload);
        showToast(data.message, 'success');
      } else {
        const { data } = await api.post('/users', payload);
        showToast(data.message, 'success');
      }
      setModalOpen(false);
      loadStudents();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save student.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data } = await api.delete(`/users/${deleteTarget._id}`);
      showToast(data.message, 'success');
      setDeleteTarget(null);
      loadStudents();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to remove student.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(String(ev.target?.result || ''));
    };
    reader.readAsText(file);
  };

  const downloadCsvTemplate = () => {
    const sample = 'name,email,phone,password\nClara Oswald,clara.oswald@exampro.edu,+1555019283,Welcome2026!\n';
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'exampro_students_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      showToast('Provide a CSV header row plus at least one student row.', 'error');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const nameIdx = headers.indexOf('name');
    const emailIdx = headers.indexOf('email');
    const phoneIdx = headers.indexOf('phone');
    const passIdx = headers.indexOf('password');

    if (nameIdx === -1 || emailIdx === -1 || passIdx === -1) {
      showToast('CSV header must include name, email, and password columns.', 'error');
      return;
    }

    const parsed = lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim());
      return {
        name: cols[nameIdx] || '',
        email: cols[emailIdx] || '',
        phone: phoneIdx >= 0 ? cols[phoneIdx] || '' : '',
        password: cols[passIdx] || '',
      };
    });

    setImporting(true);
    try {
      const { data } = await api.post('/users/import-csv', {
        students: parsed,
        defaultClassId: csvClassId || null,
      });
      showToast(data.message, 'success');
      setCsvOpen(false);
      setCsvText('');
      loadStudents();
    } catch (err) {
      showToast(extractErrorMessage(err, 'CSV import failed.'), 'error');
    } finally {
      setImporting(false);
    }
  };

  const openHistory = async (stu: User) => {
    setHistoryStudent(stu);
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const { data } = await api.get<{ attempts: any[] }>(`/users/${stu._id}`);
      setHistoryAttempts(data.attempts || []);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load student history.'), 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Student Directory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage enrolled students, class cohorts, CSV bulk onboarding, and exam history.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setCsvClassId(classes[0]?._id || '');
              setCsvOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email, or student ID..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => {
            setClassFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Classes</option>
          {classes.map((cls) => (
            <option key={cls._id} value={cls._id}>
              {cls.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={6} />
      ) : students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students found"
          description="Add individual students or import a roster via CSV."
          action={
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              Add First Student
            </button>
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-5">Student</th>
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {students.map((stu) => (
                  <tr key={stu._id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <Avatar src={stu.profileImage} name={stu.name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{stu.name}</p>
                          <p className="text-xs text-slate-500 truncate">{stu.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                      {stu.studentId || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {typeof stu.classId === 'object' && stu.classId
                        ? stu.classId.name
                        : 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                      {stu.phone || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusTag status={stu.status} />
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openHistory(stu)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                          title="View Exam History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(stu)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                          title="Edit Student"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(stu)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                          title="Delete or Deactivate"
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

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? 'Edit Student Account' : 'Add New Student'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {classes.map((cls) => (
                    <option key={cls._id} value={cls._id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {editing ? 'Reset Password (optional)' : 'Initial Password'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editing ? 'Leave blank to keep current password' : 'Minimum 6 characters'}
                  required={!editing}
                  minLength={password ? 6 : undefined}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editing ? 'Update Student' : 'Create Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {csvOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Import Students from CSV
              </h2>
              <button
                type="button"
                onClick={() => setCsvOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCsvImport} className="space-y-4">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                <span className="text-xs text-slate-600">
                  Columns: <span className="font-mono">name,email,phone,password</span>
                </span>
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Template CSV</span>
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assign Imported Students to Class
                </label>
                <select
                  value={csvClassId}
                  onChange={(e) => setCsvClassId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="">Unassigned</option>
                  {classes.map((cls) => (
                    <option key={cls._id} value={cls._id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Upload CSV File
                </label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFile}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Or Paste CSV Content
                </label>
                <textarea
                  rows={5}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder={'name,email,phone,password\nClara Oswald,clara@exampro.edu,+15551234,Secret2026'}
                  required
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCsvOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60"
                >
                  {importing ? 'Importing...' : 'Run CSV Import'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-xl w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Examination History
                </h2>
                <p className="text-xs text-slate-500">
                  {historyStudent?.name} · {historyStudent?.studentId}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {loadingHistory ? (
              <p className="py-8 text-center text-sm text-slate-500">Loading history...</p>
            ) : historyAttempts.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No examination attempts recorded for this student.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {historyAttempts.map((att) => (
                  <div key={att._id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {att.examId?.title || 'Examination'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Attempt #{att.attemptNumber} ·{' '}
                        {att.submittedAt
                          ? new Date(att.submittedAt).toLocaleDateString()
                          : 'In progress'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs font-semibold text-slate-800 tabular-nums">
                        {att.score}/{att.totalMarks} ({att.percentage}%)
                      </span>
                      <StatusTag status={att.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete or Deactivate Student"
        description={`Remove "${deleteTarget?.name}"? Students with submitted examination records will be deactivated rather than permanently erased.`}
        confirmLabel="Confirm"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
