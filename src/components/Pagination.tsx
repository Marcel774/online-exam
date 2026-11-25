import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  onPageChange: (nextPage: number) => void;
}

export function Pagination({ page, pages, total, onPageChange }: PaginationProps) {
  if (total === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-t border-slate-200 bg-white text-sm">
      <p className="text-slate-600 tabular-nums">
        Page <span className="font-semibold text-slate-900">{page}</span> of{' '}
        <span className="font-semibold text-slate-900">{pages}</span> ·{' '}
        <span className="font-medium">{total}</span> total record(s)
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap shrink-0"
        >
          Next
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
