import React from "react";

export default function Table({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <table className={`min-w-full bg-white rounded-lg shadow ${className}`}>
      {children}
    </table>
  );
}
