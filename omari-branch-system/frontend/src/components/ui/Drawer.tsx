import { useEffect, type ReactNode } from "react";

import { X } from "lucide-react";

import { cn } from "./cn";

type DrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
};

export function Drawer({
  open,
  title,
  onClose,
  children,
  widthClassName = "w-full max-w-2xl",
}: DrawerProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/35" onClick={onClose} />
      <div className={cn("absolute right-0 top-0 h-full bg-white shadow-xl", widthClassName)}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
