import React from "react";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6 hidden md:flex flex-col">
        <img src={require("../assets/logo.png")}
          alt="Omari Logo"
          className="h-10 mb-8" />
        <nav className="flex flex-col gap-2">
          <a href="/" className="font-medium text-slate-700 hover:text-green-600">Dashboard</a>
          <a href="/branches" className="font-medium text-slate-700 hover:text-green-600">Branches</a>
          <a href="/metrics" className="font-medium text-slate-700 hover:text-green-600">Metrics</a>
          <a href="/expenses" className="font-medium text-slate-700 hover:text-green-600">Expenses</a>
          <a href="/alerts" className="font-medium text-slate-700 hover:text-green-600">Alerts</a>
          <a href="/trends" className="font-medium text-slate-700 hover:text-green-600">Trends</a>
        </nav>
      </aside>
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="font-bold text-lg text-green-700">Omari Branch System</div>
          <div className="flex items-center gap-4">
            <span className="text-slate-600">Welcome, User</span>
            <button className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">Logout</button>
          </div>
        </header>
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
