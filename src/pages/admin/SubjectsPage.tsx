import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusTag } from '../../components/StatusTag';
import { EmptyState, TableSkeleton } from '../../components/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { ClassItem, SubjectItem, User } from '../../types';

export function SubjectsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectItem | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [classId, setClassId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SubjectItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ subjects: SubjectItem[] }>('/subjects', {
        params: {
          search: search.trim() || undefined,
          classId: classFilter || undefined,
        },
      });
      setSubjects(data.subjects || []);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load subjects.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [search, classFilter, showToast]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  useEffect(() => {
    api
      .get<{ classes: ClassItem[] }>('/classes')
      .then((res) => setClasses(res.data.classes || []))
      .catch(() => {});

    if (isAdmin) {
      api
        .get<{ users: User[] }>('/users', { params: { role: 'teacher', limit: 100 } })
        .then((res) => setTeachers(res.data.users || []))
        .catch(() => {});
    }
  }, [isAdmin]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCode('');
    setDescription('');
    setClassId(classes[0]?._id || '');
    setTeacherId('');
    setStatus('active');
    setModalOpen(true);
  };

  const openEdit = (sub: SubjectItem) => {
    setEditing(sub);
    setName(sub.name);
    setCode(sub.code);
    setDescription(sub.description || '');
    setClassId(typeof sub.classId === 'string' ? sub.classId : sub.classId?._id || '');
    setTeacherId(
      typeof sub.teacherId === 'string' ? sub.teacherId : sub.teacherId?._id || ''
    );
    setStatus(sub.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !classId) {
      showToast('Subject name, code, and class are required.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        classId,
        teacherId: teacherId || null,
        status,
      };
      if (editing) {
        const { data } = await api.put(`/subjects/${editing._id}`, payload);
        showToast(data.message, 'success');
      } else {
        const { data } = await api.post('/subjects', payload);
        showToast(data.message, 'success');
      }
      setModalOpen(false);
      loadSubjects();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save subject.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data } = await api.delete(`/subjects/${deleteTarget._id}`);
      showToast(data.message, 'success');
      setDeleteTarget(null);
      loadSubjects();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete subject.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {isAdmin ? 'Subjects Curriculum' : 'My Assigned Subjects'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Subject codes, assigned classes, instructors, and question bank totals.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Subject</span>
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subjects or codes..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
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
        <TableSkeleton rows={4} cols={6} />
      ) : subjects.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No subjects found"
          description="Create subjects and assign them to classes and instructors."
          action={
            isAdmin && (
              <button
                type="button"
                onClick={openCreate}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                Create First Subject
              </button>
            )
          }
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-5">Code</th>
                  <th className="py-3 px-4">Subject Name</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Instructor</th>
                  <th className="py-3 px-4 text-right">Questions</th>
                  <th className="py-3 px-4">Status</th>
                  {isAdmin && <th className="py-3 px-5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {subjects.map((sub) => (
                  <tr key={sub._id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-5 font-mono text-xs font-semibold text-indigo-700">
                      {sub.code}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-900">{sub.name}</p>
                      {sub.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {sub.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {typeof sub.classId === 'object' ? sub.classId?.name : '-'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {typeof sub.teacherId === 'object' && sub.teacherId
                        ? sub.teacherId.name
                        : 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {sub.questionCount ?? 0}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusTag status={sub.status} />
                    </td>
                    {isAdmin && (
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(sub)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                            aria-label={`Edit ${sub.name}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(sub)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                            aria-label={`Delete ${sub.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? 'Edit Subject' : 'Create Subject'}
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
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Subject Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Linear Algebra"
                    required
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="MATH-201"
                    required
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select class</option>
                  {classes.map((cls) => (
                    <option key={cls._id} value={cls._id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Assign Instructor
                </label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {teachers.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.teacherId || t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {editing && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'active' | 'archived')}
                    className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              )}

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
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete or Archive Subject"
        description={`Confirm removing "${deleteTarget?.name}". Subjects linked to questions or examinations will be archived to preserve academic integrity.`}
        confirmLabel="Confirm Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
