import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
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
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Layers,
  Plus,
  UserCheck,
  Users,
} from 'lucide-react';
import { api, extractErrorMessage } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { StatusTag } from '../../components/StatusTag';

interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
}

function MetricCard({ label, value, sublabel, icon: Icon }: MetricCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
        <p className="mt-1.5 font-display text-2xl font-bold text-slate-900 tabular-nums">
          {value}
        </p>
        {sublabel && <p className="mt-1 text-xs text-slate-500 truncate">{sublabel}</p>}
      </div>
      <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-indigo-600 shrink-0">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}

const PIE_COLORS = ['#4f46e5', '#d97706', '#16a34a', '#94a3b8'];

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get('/dashboard/stats')
      .then((res) => {
        if (active) setData(res.data);
      })
      .catch((err) => {
        if (active) setError(extractErrorMessage(err, 'Failed to load dashboard data.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-56 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 bg-white border border-slate-200 rounded-xl" />
          <div className="h-72 bg-white border border-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        {error || 'Dashboard data unavailable.'}
      </div>
    );
  }

  if (user?.role === 'admin') {
    const m = data.metrics;
    const charts = data.charts;
    const recent = data.recent;

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              System Overview
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Institution-wide enrollment, examinations, and assessment metrics.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/reports"
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              View Reports
            </Link>
            <Link
              to="/exams/create"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create Exam</span>
            </Link>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Total Students" value={m.totalStudents} icon={Users} />
          <MetricCard label="Total Teachers" value={m.totalTeachers} icon={UserCheck} />
          <MetricCard label="Active Classes" value={m.totalClasses} sublabel={`${m.totalSubjects} subjects`} icon={Layers} />
          <MetricCard
            label="Examinations"
            value={m.totalExams}
            sublabel={`${m.activeExams} active · ${m.completedExams} completed`}
            icon={ClipboardList}
          />
          <MetricCard label="Total Submissions" value={m.totalSubmissions} icon={CheckCircle2} />
          <MetricCard label="Overall Pass Rate" value={`${m.passRate}%`} icon={Award} />
          <MetricCard label="Active Subjects" value={m.totalSubjects} icon={BookOpen} />
          <MetricCard label="Active Exams" value={m.activeExams} icon={Clock} />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Student Enrollment by Class
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">
              Active students and subjects across academic cohorts
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.enrollmentChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="students" name="Students" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="subjects" name="Subjects" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Examination Status
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 mb-4">Distribution across lifecycle</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.examStatusChart}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {charts.examStatusChart.map((_: unknown, idx: number) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Grade Distribution Chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Student Performance Distribution
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Grade breakdown across all recorded examination results
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.performanceChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="grade" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Results" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Recent Examinations
              </h2>
              <Link to="/exams" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                View All
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recent.recentExams.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No examinations created yet.</p>
              ) : (
                recent.recentExams.map((ex: any) => (
                  <div key={ex._id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{ex.title}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {ex.subjectId?.name || 'Subject'} · {ex.classId?.name || 'Class'}
                      </p>
                    </div>
                    <StatusTag status={ex.status} />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Recent Submissions
              </h2>
              <Link to="/results" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                View Results
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recent.recentSubmissions.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No submissions recorded yet.</p>
              ) : (
                recent.recentSubmissions.map((sub: any) => (
                  <div key={sub._id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {sub.studentId?.name || 'Student'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {sub.examId?.title || 'Examination'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                        {sub.score}/{sub.totalMarks}
                      </span>
                      <StatusTag status={sub.status} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (user?.role === 'teacher') {
    const m = data.metrics;
    const charts = data.charts;
    const recent = data.recent;

    return (
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              Instructor Workspace
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage your assigned examinations, question bank, and student grading queue.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/questions"
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Question Bank
            </Link>
            <Link
              to="/exams/create"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create Exam</span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard label="Assigned Classes" value={m.assignedClasses} icon={Layers} />
          <MetricCard label="Enrolled Students" value={m.totalStudents} icon={Users} />
          <MetricCard label="Total Examinations" value={m.totalExams} icon={ClipboardList} />
          <MetricCard label="Upcoming / Active" value={m.upcomingExams} icon={CalendarClock} />
          <MetricCard label="Completed Exams" value={m.completedExams} icon={CheckCircle2} />
          <MetricCard label="Pending Grading" value={m.pendingGrading} icon={Clock} />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Average Student Score by Examination
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-4">
            Percentage performance across your administered assessments
          </p>
          {charts.performanceByExam.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Performance charts will populate once students complete examinations.
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.performanceByExam}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Tooltip />
                  <Bar dataKey="avgScore" name="Avg Score (%)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">Your Examinations</h2>
              <Link to="/exams" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                Manage All
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recent.recentExams.map((ex: any) => (
                <div key={ex._id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{ex.title}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {ex.subjectId?.name} · {ex.duration} min · {ex.totalMarks} marks
                    </p>
                  </div>
                  <StatusTag status={ex.status} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">Recent Submissions</h2>
              <Link to="/results" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                Grading Queue
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {recent.recentSubmissions.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No student submissions yet.</p>
              ) : (
                recent.recentSubmissions.map((sub: any) => (
                  <div key={sub._id} className="px-6 py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {sub.studentId?.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{sub.examId?.title}</p>
                    </div>
                    <StatusTag status={sub.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Student Dashboard
  const m = data.metrics;
  const charts = data.charts;
  const recent = data.recent;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Welcome, {user?.name}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track upcoming assessments, take active examinations, and review published results.
          </p>
        </div>
        <Link
          to="/student/exams/available"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg whitespace-nowrap shrink-0"
        >
          <span>View Available Exams</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Assigned Exams" value={m.totalExams} icon={ClipboardList} />
        <MetricCard label="Active / Upcoming" value={m.upcomingExams} icon={CalendarClock} />
        <MetricCard label="Completed Attempts" value={m.completedExams} icon={CheckCircle2} />
        <MetricCard
          label="Average Published Score"
          value={m.publishedCount > 0 ? `${m.averageScore}%` : '—'}
          sublabel={`${m.publishedCount} published result(s)`}
          icon={Award}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h2 className="font-display text-base font-semibold text-slate-900">
          Published Score Trajectory
        </h2>
        <p className="text-xs text-slate-500 mt-0.5 mb-4">Your verified percentages across released exams</p>
        {charts.scoreTrend.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">
            Score trajectory appears once examination results are published by your instructors.
          </p>
        ) : (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.scoreTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="percentage"
                  name="Score (%)"
                  stroke="#4f46e5"
                  fill="#eef2ff"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Examination Schedule
            </h2>
            <Link
              to="/student/exams/available"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              See All
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recent.upcomingSchedule.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No upcoming or active examinations scheduled.</p>
            ) : (
              recent.upcomingSchedule.map((ex: any) => (
                <div key={ex._id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{ex.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {ex.subjectId?.name} · {ex.duration} min · Starts{' '}
                      {new Date(ex.startDate).toLocaleString()}
                    </p>
                  </div>
                  <Link
                    to={`/student/exams/${ex._id}/instructions`}
                    className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 whitespace-nowrap shrink-0"
                  >
                    Open
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Latest Published Results
            </h2>
            <Link to="/results" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
              View All
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recent.latestResults.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">No results have been published yet.</p>
            ) : (
              recent.latestResults.map((resItem: any) => (
                <div key={resItem._id} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {resItem.examId?.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      Score: {resItem.marksObtained}/{resItem.totalMarks} ({resItem.percentage}%) · Grade{' '}
                      {resItem.grade}
                    </p>
                  </div>
                  <StatusTag status={resItem.passed ? 'passed' : 'failed'} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
