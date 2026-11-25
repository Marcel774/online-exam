import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api, extractErrorMessage } from '../../services/api';
import { useToast } from '../../context/ToastContext';

type ReportTab = 'exams' | 'students' | 'classes' | 'subjects' | 'participation';

export function ReportsPage() {
  const { showToast } = useToast();
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportTab>('exams');

  useEffect(() => {
    setLoading(true);
    api
      .get('/reports')
      .then((res) => setReportData(res.data))
      .catch((err) => showToast(extractErrorMessage(err, 'Failed to generate reports.'), 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const getActiveTableData = (): { title: string; headers: string[]; rows: (string | number)[][] } => {
    if (!reportData) return { title: 'Report', headers: [], rows: [] };

    if (activeTab === 'exams') {
      return {
        title: 'Examination Results Report',
        headers: ['Examination', 'Subject', 'Class', 'Submissions', 'Avg %', 'Pass Rate'],
        rows: reportData.examResultsReport.map((r: any) => [
          r.title,
          r.subject,
          r.className,
          r.submissions,
          `${r.averagePercentage}%`,
          `${r.passRate}%`,
        ]),
      };
    }
    if (activeTab === 'students') {
      return {
        title: 'Student Performance Report',
        headers: ['Student ID', 'Name', 'Class', 'Exams Taken', 'Avg %', 'Passed / Failed'],
        rows: reportData.studentPerfReport.map((r: any) => [
          r.studentId,
          r.name,
          r.className,
          r.examsTaken,
          `${r.averagePercentage}%`,
          `${r.passed} / ${r.failed}`,
        ]),
      };
    }
    if (activeTab === 'classes') {
      return {
        title: 'Class Performance Report',
        headers: ['Class Name', 'Academic Year', 'Submissions', 'Avg %', 'Pass Rate'],
        rows: reportData.classPerfReport.map((r: any) => [
          r.className,
          r.academicYear,
          r.submissions,
          `${r.averagePercentage}%`,
          `${r.passRate}%`,
        ]),
      };
    }
    if (activeTab === 'subjects') {
      return {
        title: 'Subject Performance Report',
        headers: ['Code', 'Subject Name', 'Class', 'Submissions', 'Avg %', 'Pass Rate'],
        rows: reportData.subjectPerfReport.map((r: any) => [
          r.code,
          r.subjectName,
          r.className,
          r.submissions,
          `${r.averagePercentage}%`,
          `${r.passRate}%`,
        ]),
      };
    }
    return {
      title: 'Examination Participation Report',
      headers: ['Examination', 'Class', 'Eligible', 'Participated', 'Participation Rate'],
      rows: reportData.participationReport.map((r: any) => [
        r.title,
        r.className,
        r.eligibleStudents,
        r.participated,
        `${r.participationRate}%`,
      ]),
    };
  };

  const handleExportCsv = () => {
    const { title, headers, rows } = getActiveTableData();
    const csvLines = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('CSV report downloaded.', 'success');
  };

  const handleExportPdf = () => {
    const { title, headers, rows } = getActiveTableData();
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`EXAMPRO — ${title}`, 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on ${new Date().toLocaleString()}`, 14, 25);

    autoTable(doc, {
      startY: 32,
      head: [headers],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}.pdf`);
    showToast('PDF report exported.', 'success');
  };

  if (loading || !reportData) {
    return <div className="p-8 text-sm text-slate-500">Generating analytics reports...</div>;
  }

  const tableData = getActiveTableData();
  const passFailChartData = [
    { name: 'Passed', value: reportData.passFailSummary.passed },
    { name: 'Failed', value: reportData.passFailSummary.failed },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Reports & Academic Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Examination pass rates, participation metrics, and exportable CSV / PDF reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg whitespace-nowrap shrink-0"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* Charts Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-slate-900 mb-4">
            Average Score by Examination (%)
          </h2>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData.examResultsReport}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="title"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 16)}…` : v)}
                />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="averagePercentage" name="Average %" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900">
              Pass & Fail Ratio
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              Overall pass rate: {reportData.passFailSummary.passRate}% (
              {reportData.passFailSummary.total} evaluated)
            </p>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={passFailChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={72}
                  paddingAngle={4}
                >
                  <Cell fill="#16a34a" />
                  <Cell fill="#dc2626" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 text-xs text-slate-600 tabular-nums">
            <span className="font-semibold text-emerald-700">
              Passed: {reportData.passFailSummary.passed}
            </span>
            <span className="font-semibold text-red-700">
              Failed: {reportData.passFailSummary.failed}
            </span>
          </div>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        {(
          [
            { id: 'exams', label: 'Exam Results' },
            { id: 'students', label: 'Student Performance' },
            { id: 'classes', label: 'Class Performance' },
            { id: 'subjects', label: 'Subject Performance' },
            { id: 'participation', label: 'Participation' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="font-display text-base font-semibold text-slate-900">
            {tableData.title}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                {tableData.headers.map((h) => (
                  <th key={h} className="py-3 px-5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {tableData.rows.length === 0 ? (
                <tr>
                  <td colSpan={tableData.headers.length} className="py-8 text-center text-slate-500">
                    No records available for this report.
                  </td>
                </tr>
              ) : (
                tableData.rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    {row.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        className={`py-3.5 px-5 ${
                          cIdx === 0 ? 'font-medium text-slate-900' : 'text-slate-700 tabular-nums'
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
