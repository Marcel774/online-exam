import React from 'react';
import {
  CheckCircle2,
  Clock,
  FileEdit,
  PlayCircle,
  Archive,
  XCircle,
  Send,
} from 'lucide-react';

interface StatusTagProps {
  status: string;
}

const STATUS_MAP: Record<
  string,
  { label: string; classes: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  active: {
    label: 'Active',
    classes: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    Icon: PlayCircle,
  },
  published: {
    label: 'Published',
    classes: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    Icon: Send,
  },
  scheduled: {
    label: 'Scheduled',
    classes: 'text-amber-700 bg-amber-50 border-amber-200',
    Icon: Clock,
  },
  completed: {
    label: 'Completed',
    classes: 'text-slate-700 bg-slate-100 border-slate-200',
    Icon: CheckCircle2,
  },
  draft: {
    label: 'Draft',
    classes: 'text-slate-600 bg-slate-50 border-slate-200',
    Icon: FileEdit,
  },
  archived: {
    label: 'Archived',
    classes: 'text-slate-500 bg-slate-100 border-slate-200',
    Icon: Archive,
  },
  inactive: {
    label: 'Inactive',
    classes: 'text-red-700 bg-red-50 border-red-200',
    Icon: XCircle,
  },
  graded: {
    label: 'Graded',
    classes: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    Icon: CheckCircle2,
  },
  pending: {
    label: 'Pending Grading',
    classes: 'text-amber-700 bg-amber-50 border-amber-200',
    Icon: Clock,
  },
  submitted: {
    label: 'Submitted',
    classes: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    Icon: CheckCircle2,
  },
  in_progress: {
    label: 'In Progress',
    classes: 'text-amber-700 bg-amber-50 border-amber-200',
    Icon: Clock,
  },
  passed: {
    label: 'Passed',
    classes: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    classes: 'text-red-700 bg-red-50 border-red-200',
    Icon: XCircle,
  },
};

export function StatusTag({ status }: StatusTagProps) {
  const key = (status || '').toLowerCase();
  const config = STATUS_MAP[key] || {
    label: status || 'Unknown',
    classes: 'text-slate-700 bg-slate-100 border-slate-200',
    Icon: Clock,
  };
  const Icon = config.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border whitespace-nowrap shrink-0 ${config.classes}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{config.label}</span>
    </span>
  );
}
