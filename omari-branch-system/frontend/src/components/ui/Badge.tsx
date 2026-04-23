import { cn } from "./cn";

type BadgeVariant = "neutral" | "success" | "warning" | "danger";

type BadgeProps = {
  children: string;
  variant?: BadgeVariant;
};

export function Badge({ children, variant = "neutral" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "neutral" && "bg-slate-100 text-slate-700",
        variant === "success" && "bg-emerald-100 text-emerald-700",
        variant === "warning" && "bg-amber-100 text-amber-800",
        variant === "danger" && "bg-rose-100 text-rose-700",
      )}
    >
      {children}
    </span>
  );
}
