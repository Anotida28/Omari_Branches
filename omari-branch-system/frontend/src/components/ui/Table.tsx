import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "./cn";

type TableProps = TableHTMLAttributes<HTMLTableElement>;
type TableSectionProps = HTMLAttributes<HTMLTableSectionElement>;
type TableRowProps = HTMLAttributes<HTMLTableRowElement>;
type TableCellProps = TdHTMLAttributes<HTMLTableCellElement>;
type TableHeadCellProps = ThHTMLAttributes<HTMLTableCellElement>;

export function TableContainer({ className, children }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-slate-200 bg-white", className)}>
      {children}
    </div>
  );
}

export function Table({ className, ...props }: TableProps) {
  return <table className={cn("min-w-full divide-y divide-slate-200 text-sm", className)} {...props} />;
}

export function TableHead({ className, ...props }: TableSectionProps) {
  return <thead className={cn("bg-slate-50", className)} {...props} />;
}

export function TableBody({ className, ...props }: TableSectionProps) {
  return <tbody className={cn("divide-y divide-slate-200 bg-white", className)} {...props} />;
}

export function TableRow({ className, ...props }: TableRowProps) {
  return <tr className={cn("transition-colors", className)} {...props} />;
}

export function TableHeadCell({ className, ...props }: TableHeadCellProps) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TableCellProps) {
  return <td className={cn("px-4 py-3 text-slate-700", className)} {...props} />;
}
