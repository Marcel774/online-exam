import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2, UserCheck, X } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../../components/Avatar';
import { StatusTag } from '../../components/StatusTag';
import { Pagination } from '../../components/Pagination';
import { EmptyState, TableSkeleton } from '../../components/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { ClassItem, SubjectItem, User } from '../../types';

export function TeachersPage() {
  const { showToast } = useToast();

  const [teachers, setTeachers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [password, setPassword] = useState('');
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{
        users: User[];
        pagination: { total: number; page: number; pages: number };
      }>('/users', {
        params: {
          role: 'teacher',
          search: search.trim() || undefined,
          page,
          limit: 15,
        },
      });
      setTeachers(data.users || []);
      setPagination(data.pagination);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load teachers.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [search, page, showToast]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

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

  const openCreate = () => {
    setEditing(null);
    setName('');
    setEmail('');
    setPhone('');
    setStatus('active');
    setPassword('');
    setAssignedClasses([]);
    setAssignedSubjects([]);
    setModalOpen(true);
  };

  const openEdit = (t: User) => {
    setEditing(t);
    setName(t.name);
    setEmail(t.email);
    setPhone(t.phone || '');
    setStatus(t.status);
    setPassword('');
    setAssignedClasses(
      (t.assignedClasses || []).map((c) => (typeof c === 'string' ? c : c._id))
    );
    setAssignedSubjects(
      (t.assignedSubjects || []).map((s) => (typeof s === 'string' ? s : s._id))
    );
    setModalOpen(true);
  };

  const toggleItem = (list: string[], id: string, setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter((i) => i !== id) : [...list, id]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast('Name and email are required.', 'error');
      return;
    }
    if (!editing && password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        status,
        role: 'teacher',
        assignedClasses,
        assignedSubjects,
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
      loadTeachers();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save teacher.'), 'error');
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
      loadTeachers();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to remove teacher.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Faculty & Teachers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage teacher accounts, assigned classes, and subject permissions.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Teacher</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search teachers by name, email, or ID..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : teachers.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="No teachers found"
          description="Add faculty members and assign their classes and subjects."
          action={
            <button
              type="button"
              onClick={openCreate}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            >
              Add First Teacher
            </button>
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-5">Teacher</th>
                  <th className="py-3 px-4">Teacher ID</th>
                  <th className="py-3 px-4">Assigned Classes</th>
                  <th className="py-3 px-4">Assigned Subjects</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {teachers.map((t) => (
                  <tr key={t._id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <Avatar src={t.profileImage} name={t.name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{t.name}</p>
                          <p className="text-xs text-slate-500 truncate">{t.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700">
                      {t.teacherId || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700">
                      {(t.assignedClasses || []).length > 0
                        ? (t.assignedClasses || [])
                            .map((c) => (typeof c === 'object' ? c.name : c))
                            .join(', ')
                        : 'None'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-700">
                      {(t.assignedSubjects || []).length > 0
                        ? (t.assignedSubjects || [])
                            .map((s) => (typeof s === 'object' ? `${s.code}` : s))
                            .join(', ')
                        : 'None'}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusTag status={t.status} />
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                          title="Edit Teacher"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(t)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                          title="Delete Teacher"
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? 'Edit Teacher' : 'Add New Teacher'}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
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
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Assign Classes
                </label>
                <div className="border border-slate-200 rounded-lg p-3 max-h-32 overflow-y-auto space-y-2">
                  {classes.map((cls) => (
                    <label key={cls._id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignedClasses.includes(cls._id)}
                        onChange={() => toggleItem(assignedClasses, cls._id, setAssignedClasses)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{cls.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Assign Subjects
                </label>
                <div className="border border-slate-200 rounded-lg p-3 max-h-32 overflow-y-auto space-y-2">
                  {subjects.map((sub) => (
                    <label key={sub._id} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignedSubjects.includes(sub._id)}
                        onChange={() => toggleItem(assignedSubjects, sub._id, setAssignedSubjects)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>
                        <span className="font-mono text-xs text-slate-500 mr-1.5">{sub.code}</span>
                        {sub.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {editing ? 'Reset Password (optional)' : 'Initial Password'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editing ? 'Leave blank to keep current' : 'Minimum 6 characters'}
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
                  {saving ? 'Saving...' : editing ? 'Update Teacher' : 'Create Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove Teacher Account"
        description={`Are you sure you want to remove "${deleteTarget?.name}"?`}
        confirmLabel="Remove Teacher"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
