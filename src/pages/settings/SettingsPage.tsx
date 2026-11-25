import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { GradingScaleBand, SystemSettings } from '../../types';

export function SettingsPage() {
  const { showToast } = useToast();
  const [institutionName, setInstitutionName] = useState('EXAMPRO Academy');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [defaultExamDuration, setDefaultExamDuration] = useState(60);
  const [allowSelfRegistration, setAllowSelfRegistration] = useState(true);
  const [gradingScale, setGradingScale] = useState<GradingScaleBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ settings: SystemSettings }>('/settings')
      .then((res) => {
        const s = res.data.settings;
        setInstitutionName(s.institutionName);
        setAcademicYear(s.academicYear);
        setDefaultExamDuration(s.defaultExamDuration);
        setAllowSelfRegistration(s.allowSelfRegistration);
        setGradingScale(s.gradingScale || []);
      })
      .catch((err) => showToast(extractErrorMessage(err, 'Failed to load settings.'), 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const updateBand = (index: number, field: keyof GradingScaleBand, value: string | number) => {
    setGradingScale((prev) =>
      prev.map((band, idx) => (idx === index ? { ...band, [field]: value } : band))
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/settings', {
        institutionName: institutionName.trim(),
        academicYear: academicYear.trim(),
        defaultExamDuration: Number(defaultExamDuration),
        allowSelfRegistration,
        gradingScale,
      });
      showToast(data.message, 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save settings.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-slate-500">Loading system settings...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">System Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure institution identity, registration policies, and automated grading scale thresholds.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Institution Configuration
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Institution Name
              </label>
              <input
                type="text"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Active Academic Year
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Default Exam Duration (minutes)
              </label>
              <input
                type="number"
                min={5}
                value={defaultExamDuration}
                onChange={(e) => setDefaultExamDuration(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
            <label className="flex items-center gap-2.5 pt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={allowSelfRegistration}
                onChange={(e) => setAllowSelfRegistration(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Allow public student self-registration
              </span>
            </label>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Configurable Grading Scale
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Percentage thresholds used when computing letter grades during automatic and manual grading.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-2 pr-3">Grade</th>
                  <th className="py-2 px-3">Min %</th>
                  <th className="py-2 px-3">Max %</th>
                  <th className="py-2 pl-3">Descriptor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gradingScale.map((band, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 pr-3">
                      <input
                        type="text"
                        value={band.grade}
                        onChange={(e) => updateBand(idx, 'grade', e.target.value)}
                        className="w-16 px-2.5 py-1.5 font-mono font-bold border border-slate-300 rounded-lg"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={band.minPercentage}
                        onChange={(e) => updateBand(idx, 'minPercentage', Number(e.target.value))}
                        className="w-24 px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={band.maxPercentage}
                        onChange={(e) => updateBand(idx, 'maxPercentage', Number(e.target.value))}
                        className="w-24 px-2.5 py-1.5 font-mono border border-slate-300 rounded-lg"
                      />
                    </td>
                    <td className="py-2.5 pl-3">
                      <input
                        type="text"
                        value={band.label}
                        onChange={(e) => updateBand(idx, 'label', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Settings...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
