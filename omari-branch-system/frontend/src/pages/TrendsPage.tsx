import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardHeader } from "../components/ui/Card";
import { getErrorMessage } from "../services/api";
import { listBranches } from "../services/branches";
import { formatCurrency } from "../services/format";
import { fetchTrendsData } from "../services/trends";

const PIE_COLORS = ["#2563eb", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"];

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatCompactCurrency(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (absolute >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatTooltipMoney(value: number | string | undefined): string {
  return formatCurrency(Number(value ?? 0));
}

function formatTooltipLabel(label: unknown): string {
  return formatDateLabel(String(label ?? ""));
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-sm text-slate-500">{hint}</p> : null}
    </Card>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
      {message}
    </div>
  );
}

export default function TrendsPage() {
  const [branchId, setBranchId] = useState("");
  const [dateTo, setDateTo] = useState(toInputDate(new Date()));
  const [dateFrom, setDateFrom] = useState(toInputDate(shiftDays(new Date(), -60)));

  const branchesQuery = useQuery({
    queryKey: ["branches", "all", "for-trends"],
    queryFn: () => listBranches({ page: 1, pageSize: 100 }),
  });

  const trendsQuery = useQuery({
    queryKey: ["trends", { branchId, dateFrom, dateTo }],
    queryFn: () =>
      fetchTrendsData({
        branchId: branchId || undefined,
        dateFrom,
        dateTo,
      }),
  });

  const branchName = useMemo(() => {
    if (!branchId) {
      return "All Branches";
    }
    return (
      branchesQuery.data?.items.find((branch) => branch.id === branchId)?.displayName ??
      "Selected Branch"
    );
  }, [branchId, branchesQuery.data?.items]);

  const combinedError = (() => {
    if (branchesQuery.isError) {
      return getErrorMessage(branchesQuery.error);
    }
    if (trendsQuery.isError) {
      return getErrorMessage(trendsQuery.error);
    }
    return "";
  })();

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader
          title="Trends"
          subtitle="Cash movement, exposure, and alerts performance"
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Branch</label>
            <select
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All branches</option>
              {(branchesQuery.data?.items ?? []).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                setDateTo(toInputDate(today));
                setDateFrom(toInputDate(shiftDays(today, -60)));
                setBranchId("");
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </Card>

      {combinedError ? (
        <Card>
          <p className="text-sm text-rose-600">{combinedError}</p>
        </Card>
      ) : null}

      {trendsQuery.isLoading ? (
        <Card>
          <p className="text-sm text-slate-600">Loading trend analytics...</p>
        </Card>
      ) : trendsQuery.data ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <KpiCard
              label="Total Cash on Branch"
              value={formatCurrency(trendsQuery.data.kpis.totalCashOnBranch)}
              hint={branchName}
            />
            <KpiCard
              label="Outstanding Balance"
              value={formatCurrency(trendsQuery.data.kpis.totalOutstandingBalance)}
              hint="All unpaid balances"
            />
            <KpiCard
              label="Overdue Amount"
              value={formatCurrency(trendsQuery.data.kpis.overdueAmount)}
              hint={`${trendsQuery.data.kpis.overdueCount} overdue expenses`}
            />
            <KpiCard
              label="Due in 7 Days"
              value={formatCurrency(trendsQuery.data.kpis.dueNext7Amount)}
              hint="Next 7-day exposure"
            />
            <KpiCard
              label="Alert Failure Rate"
              value={`${trendsQuery.data.kpis.alertFailureRate.toFixed(1)}%`}
              hint="FAILED / (FAILED + SENT)"
            />
            <KpiCard
              label="Date Window"
              value={`${formatDateLabel(dateFrom)} - ${formatDateLabel(dateTo)}`}
              hint={branchName}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Cash on Branch Trend" subtitle="Daily total cash position" />
              {trendsQuery.data.cashTrend.length === 0 ? (
                <ChartEmpty message="No metrics for selected filters." />
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendsQuery.data.cashTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                      <YAxis tickFormatter={formatCompactCurrency} />
                      <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                      <Line
                        type="monotone"
                        dataKey="cashOnBranch"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                        name="Cash on Branch"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Cash Composition" subtitle="Cash balance vs e-float vs vault" />
              {trendsQuery.data.cashTrend.length === 0 ? (
                <ChartEmpty message="No metrics for selected filters." />
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendsQuery.data.cashTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                      <YAxis tickFormatter={formatCompactCurrency} />
                      <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="cashBalance"
                        stackId="cash"
                        stroke="#2563eb"
                        fill="#93c5fd"
                        name="Cash Balance"
                      />
                      <Area
                        type="monotone"
                        dataKey="eFloatBalance"
                        stackId="cash"
                        stroke="#0ea5e9"
                        fill="#67e8f9"
                        name="E-Float"
                      />
                      <Area
                        type="monotone"
                        dataKey="cashInVault"
                        stackId="cash"
                        stroke="#10b981"
                        fill="#86efac"
                        name="Cash in Vault"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Cash In / Out + Net" subtitle="Operational movement per day" />
              {trendsQuery.data.cashTrend.length === 0 ? (
                <ChartEmpty message="No metrics for selected filters." />
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendsQuery.data.cashTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                      <YAxis tickFormatter={formatCompactCurrency} />
                      <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                      <Legend />
                      <Bar dataKey="cashInValue" fill="#0ea5e9" name="Cash In" />
                      <Bar dataKey="cashOutValue" fill="#f97316" name="Cash Out" />
                      <Line
                        type="monotone"
                        dataKey="netCashValue"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                        name="Net Cash"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Outstanding by Branch" subtitle="Highest unpaid exposure" />
              {trendsQuery.data.outstandingByBranch.length === 0 ? (
                <ChartEmpty message="No outstanding balances." />
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={trendsQuery.data.outstandingByBranch}
                      layout="vertical"
                      margin={{ left: 10, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tickFormatter={formatCompactCurrency} />
                      <YAxis type="category" dataKey="branchName" width={140} />
                      <Tooltip formatter={formatTooltipMoney} />
                      <Bar dataKey="outstandingBalance" fill="#2563eb" name="Outstanding" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Due Risk Timeline" subtitle="Upcoming vs overdue by week" />
              {trendsQuery.data.dueRiskTimeline.length === 0 ? (
                <ChartEmpty message="No due-date risk data." />
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendsQuery.data.dueRiskTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="week" />
                      <YAxis tickFormatter={formatCompactCurrency} />
                      <Tooltip formatter={formatTooltipMoney} />
                      <Legend />
                      <Bar dataKey="upcomingAmount" stackId="risk" fill="#0ea5e9" name="Upcoming" />
                      <Bar dataKey="overdueAmount" stackId="risk" fill="#ef4444" name="Overdue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Expense Type Mix" subtitle="Outstanding balance by type" />
              {trendsQuery.data.expenseTypeMix.length === 0 ? (
                <ChartEmpty message="No outstanding expense mix data." />
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={trendsQuery.data.expenseTypeMix}
                        dataKey="outstandingBalance"
                        nameKey="expenseType"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                        label
                      >
                        {trendsQuery.data.expenseTypeMix.map((entry, index) => (
                          <Cell key={entry.expenseType} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={formatTooltipMoney} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader title="Alerts Health Trend" subtitle="SENT / FAILED / SKIPPED by day" />
              {trendsQuery.data.alertsHealthTrend.length === 0 ? (
                <ChartEmpty message="No alert activity for selected filters." />
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendsQuery.data.alertsHealthTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                      <YAxis />
                      <Tooltip labelFormatter={formatTooltipLabel} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="sent"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        name="Sent"
                      />
                      <Line
                        type="monotone"
                        dataKey="failed"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                        name="Failed"
                      />
                      <Line
                        type="monotone"
                        dataKey="skipped"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        name="Skipped"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </section>
  );
}

