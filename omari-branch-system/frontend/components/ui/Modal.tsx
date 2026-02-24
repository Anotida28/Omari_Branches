import React from "react";

export default function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-lg shadow-lg p-6 min-w-[320px] max-w-lg relative">
        <button onClick={onClose} className="absolute top-2 right-2 text-slate-400 hover:text-slate-700">✕</button>
        {children}
      </div>
    </div>
  );
}
