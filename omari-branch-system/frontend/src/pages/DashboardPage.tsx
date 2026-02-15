import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, DollarSign, FileText } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardHeader } from "../components/ui/Card";
import { fetchDashboardStats } from "../services/dashboard";
import { formatCurrency } from "../services/format";
import { getErrorMessage } from "../services/api";

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="rounded-md bg-slate-100 p-2 text-slate-600">{icon}</div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const statsQuery = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: fetchDashboardStats,
  });

  const content = (() => {
    if (statsQuery.isLoading) {
      return (
        <Card>
          <p className="text-sm text-slate-600">Loading dashboard...</p>
        </Card>
      );
    }

    if (statsQuery.isError) {
      return (
        <Card>
          <p className="text-sm text-rose-600">{getErrorMessage(statsQuery.error)}</p>
        </Card>
      );
    }

    const stats = statsQuery.data;
    if (!stats) {
      return (
        <Card>
          <p className="text-sm text-slate-600">No dashboard data available.</p>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Branches"
          value={String(stats.totalBranches)}
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          label="Total Expenses"
          value={String(stats.totalExpenses)}
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          label="Overdue Expenses"
          value={String(stats.overdueExpenses)}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="Outstanding Balance"
          value={formatCurrency(stats.totalOutstandingBalance)}
          icon={<DollarSign className="h-5 w-5" />}
        />
      </div>
    );
  })();

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader
          title="Dashboard"
          subtitle="High-level HQ finance snapshot across all branches"
        />
      </Card>

      {content}
    </section>
  );
}
