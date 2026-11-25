import React, { useCallback, useEffect, useState } from 'react';
import { Layers, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StatusTag } from '../../components/StatusTag';
import { EmptyState, TableSkeleton } from '../../components/EmptyState';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { ClassItem } from '../../types';

export function ClassesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isAdmin = user?.role === 'admin';

  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [name, setName] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ClassItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ classes: ClassItem[] }>('/classes', {
        params: { search: search.trim() || undefined },
      });
      setClasses(data.classes || []);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load classes.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [search, showToast]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setAcademicYear('2026-2027');
    setDescription('');
    setStatus('active');
    setModalOpen(true);
  };

  const openEdit = (cls: ClassItem) => {
    setEditing(cls);
    setName(cls.name);
    setAcademicYear(cls.academicYear);
    setDescription(cls.description || '');
    setStatus(cls.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Class name is required.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const { data } = await api.put(`/classes/${editing._id}`, {
          name: name.trim(),
          academicYear: academicYear.trim(),
          description: description.trim(),
          status,
        });
        showToast(data.message, 'success');
      } else {
        const { data } = await api.post('/classes', {
          name: name.trim(),
          academicYear: academicYear.trim(),
          description: description.trim(),
        });
        showToast(data.message, 'success');
      }
      setModalOpen(false);
      loadClasses();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save class.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { data } = await api.delete(`/classes/${deleteTarget._id}`);
      showToast(data.message, 'success');
      setDeleteTarget(null);
      loadClasses();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete class.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {isAdmin ? 'Classes & Cohorts' : 'My Assigned Classes'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Academic cohorts, enrolled student counts, and assigned subjects.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Class</span>
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search classes..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={6} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No classes found"
          description="Create an academic class cohort to organize students, subjects, and examinations."
          action={
            isAdmin && (
              <button
                type="button"
                onClick={openCreate}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                Create First Class
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
                  <th className="py-3 px-5">Class Name</th>
                  <th className="py-3 px-4">Academic Year</th>
                  <th className="py-3 px-4 text-right">Students</th>
                  <th className="py-3 px-4 text-right">Subjects</th>
                  <th className="py-3 px-4">Status</th>
                  {isAdmin && <th className="py-3 px-5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {classes.map((cls) => (
                  <tr key={cls._id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-5">
                      <p className="font-semibold text-slate-900">{cls.name}</p>
                      {cls.description && (
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {cls.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700 tabular-nums">
                      {cls.academicYear}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-900 tabular-nums">
                      {cls.studentCount ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-900 tabular-nums">
                      {cls.subjectCount ?? 0}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusTag status={cls.status} />
                    </td>
                    {isAdmin && (
                      <td className="py-3.5 px-5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(cls)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md"
                            aria-label={`Edit ${cls.name}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(cls)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md"
                            aria-label={`Delete ${cls.name}`}
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
                {editing ? 'Edit Class' : 'Create New Class'}
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
                <label className="block text-sm font-medium text-slate-700 mb-1">Class Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Grade 12 — STEM Honors"
                  required
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Academic Year
                </label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="2026-2027"
                  required
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional cohort overview"
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
                  {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete or Archive Class"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? Classes with enrolled students or existing examinations will be archived safely to protect records.`}
        confirmLabel="Confirm Delete"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
