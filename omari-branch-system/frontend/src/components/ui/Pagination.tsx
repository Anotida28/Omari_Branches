import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-sm text-slate-600">
        Showing <span className="font-semibold text-slate-900">{start}</span>-
        <span className="font-semibold text-slate-900">{end}</span> of {" "}
        <span className="font-semibold text-slate-900">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>

        <span className="text-sm font-medium text-slate-700">
          Page {page} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
