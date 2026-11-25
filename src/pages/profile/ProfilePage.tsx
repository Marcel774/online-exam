import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Avatar } from '../../components/Avatar';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Full name is required.', 'error');
      return;
    }
    if (newPassword && newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put('/auth/profile', {
        name: name.trim(),
        phone: phone.trim(),
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
      });
      await refreshUser();
      setCurrentPassword('');
      setNewPassword('');
      showToast(data.message, 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update profile.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account details and update your password.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center gap-4">
        <Avatar src={user?.profileImage} name={user?.name || 'User'} size="lg" />
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">{user?.name}</h2>
          <p className="text-sm text-slate-600">{user?.email}</p>
          <p className="text-xs text-slate-500 capitalize mt-0.5">
            {user?.role}
            {user?.studentId ? ` · ${user.studentId}` : ''}
            {user?.teacherId ? ` · ${user.teacherId}` : ''}
            {typeof user?.classId === 'object' && user.classId ? ` · ${user.classId.name}` : ''}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            Change Password (Optional)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={newPassword ? 6 : undefined}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
