import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "./cn";

type CardProps = HTMLAttributes<HTMLDivElement>;

type CardHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-5 shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ title, subtitle, actions }: CardHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}
