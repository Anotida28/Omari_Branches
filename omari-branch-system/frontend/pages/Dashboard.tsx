import React from "react";
import MainLayout from "../layouts/MainLayout";

export default function Dashboard() {
  return (
    <MainLayout>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* KPI Cards */}
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <span className="text-3xl font-bold text-green-700">12</span>
          <span className="text-slate-600 mt-2">Branches</span>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <span className="text-3xl font-bold text-green-700">$24,000</span>
          <span className="text-slate-600 mt-2">Outstanding</span>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <span className="text-3xl font-bold text-green-700">8</span>
          <span className="text-slate-600 mt-2">Overdue</span>
        </div>
        <div className="bg-white rounded-lg shadow p-6 flex flex-col items-center">
          <span className="text-3xl font-bold text-green-700">$5,000</span>
          <span className="text-slate-600 mt-2">Paid This Month</span>
        </div>
      </div>
      {/* Add more dashboard content here */}
    </MainLayout>
  );
}
