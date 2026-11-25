import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6 bg-white border border-slate-200 rounded-xl">
      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-500 max-w-md">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex items-center gap-4 px-5 py-3.5 animate-pulse">
            {Array.from({ length: cols }).map((__, cIdx) => (
              <div
                key={cIdx}
                className="h-4 bg-slate-100 rounded flex-1"
                style={{ maxWidth: cIdx === 0 ? '220px' : undefined }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
