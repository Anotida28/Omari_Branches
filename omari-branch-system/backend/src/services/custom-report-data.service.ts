import { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma";
import { getTodayInHarare, formatDateString } from "./alert-evaluation.service";
import type {
  ReportSection,
  BranchPerformanceParams,
  TopPerformersParams,
  AlertsSummaryParams,
  FloatPositionParams,
  TransactionTrendsParams,
  TopWalletCustomersParams,
  UpcomingPaymentsParams,
  WeekSnapshotParams,
  BranchRow,
  BranchPerformanceSectionData,
  TopPerformersSectionData,
  WalletSummarySectionData,
  WalletRetentionSectionData,
  AlertsSummarySectionData,
  FloatPositionSectionData,
  TransactionTrendsSectionData,
  NewCustomersSectionData,
  TopWalletCustomersSectionData,
  RevenueBreakdownSectionData,
  UpcomingPaymentsSectionData,
  OverdueSummarySectionData,
  WeekSnapshotSectionData,
  SectionData,
} from "./custom-report-types";

function getYesterday(): Date {
  const today = getTodayInHarare();
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

function toNum(val: Prisma.Decimal | number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return Number(new Prisma.Decimal(val).toFixed(2));
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

async function fetchBranchRows(branchIds: string[], date: Date): Promise<BranchRow[]> {
  const where: Prisma.BranchMetricWhereInput = { metricDate: date };
  if (branchIds.length > 0) {
    where.branchId = { in: branchIds.map(BigInt) };
  }

  const metrics = await prisma.branchMetric.findMany({
    where,
    include: { branch: { select: { city: true, label: true } } },
    orderBy: [{ branch: { city: "asc" } }, { branch: { label: "asc" } }],
  });

  return metrics.map((m) => ({
    branchName: `${m.branch.city} - ${m.branch.label}`,
    cashInValue: toNum(m.cashInValue),
    cashInVolume: m.cashInVolume,
    cashOutValue: toNum(m.cashOutValue),
    cashOutVolume: m.cashOutVolume,
    eFloatBalance: toNum(m.eFloatBalance),
    totalCommission: toNum(m.totalCommission),
    totalTransactionVolume: m.totalTransactionVolume,
  }));
}

// ─── Original 5 builders ──────────────────────────────────────────────────────

async function buildBranchPerformance(
  section: ReportSection,
  branchIds: string[],
): Promise<BranchPerformanceSectionData> {
  const params = section.params as BranchPerformanceParams;
  const yesterday = getYesterday();
  let rows = await fetchBranchRows(branchIds, yesterday);

  const sortBy = params.sortBy ?? "cashIn";
  const order = params.order ?? "desc";

  rows = [...rows].sort((a, b) => {
    if (sortBy === "branchName") {
      return order === "asc"
        ? a.branchName.localeCompare(b.branchName)
        : b.branchName.localeCompare(a.branchName);
    }
    let av = 0, bv = 0;
    if (sortBy === "cashIn")       { av = a.cashInValue;       bv = b.cashInValue; }
    else if (sortBy === "cashOut") { av = a.cashOutValue;      bv = b.cashOutValue; }
    else if (sortBy === "eFloat")  { av = a.eFloatBalance;     bv = b.eFloatBalance; }
    else if (sortBy === "commission") { av = a.totalCommission; bv = b.totalCommission; }
    return order === "asc" ? av - bv : bv - av;
  });

  return { type: "BRANCH_PERFORMANCE", date: formatDateString(yesterday), params, rows };
}

async function buildTopPerformers(
  section: ReportSection,
  branchIds: string[],
): Promise<TopPerformersSectionData> {
  const params = section.params as TopPerformersParams;
  const metric = params.metric ?? "cashIn";
  const limit  = params.limit  ?? 10;
  const order  = params.order  ?? "desc";

  const yesterday = getYesterday();
  const rows = await fetchBranchRows(branchIds, yesterday);

  const getValue = (row: BranchRow) => {
    if (metric === "cashIn")      return row.cashInValue;
    if (metric === "cashOut")     return row.cashOutValue;
    if (metric === "eFloat")      return row.eFloatBalance;
    return row.totalCommission;
  };

  const sorted = [...rows].sort((a, b) =>
    order === "asc" ? getValue(a) - getValue(b) : getValue(b) - getValue(a),
  );

  return {
    type: "TOP_PERFORMERS",
    date: formatDateString(yesterday),
    params,
    rows: sorted.slice(0, limit).map((row, i) => ({
      rank: i + 1,
      branchName: row.branchName,
      value: getValue(row),
    })),
  };
}

async function buildWalletSummary(): Promise<WalletSummarySectionData> {
  const now = new Date();
  const cutoff30 = new Date(now.getTime() - 30 * 86_400_000);
  const cutoff90 = new Date(now.getTime() - 90 * 86_400_000);

  const [total, active30, newIn30, dormant90, lifetimeAgg, activity30Agg] = await Promise.all([
    prisma.walletCustomerActivitySnapshot.count(),
    prisma.walletCustomerActivitySnapshot.count({ where: { lastSeenDate:  { gte: cutoff30 } } }),
    prisma.walletCustomerActivitySnapshot.count({ where: { firstSeenDate: { gte: cutoff30 } } }),
    prisma.walletCustomerActivitySnapshot.count({ where: { lastSeenDate:  { lt:  cutoff90 } } }),
    prisma.walletCustomerActivitySnapshot.aggregate({ _sum: { lifetimeTransactionValue: true } }),
    prisma.walletCustomerActivitySnapshot.aggregate({ _sum: { last30DayTransactionValue: true } }),
  ]);

  return {
    type: "WALLET_SUMMARY",
    asOfDate: formatDateString(now),
    totalCustomers: total,
    activeIn30Days: active30,
    newIn30Days: newIn30,
    dormantOver90Days: dormant90,
    totalLifetimeValue: toNum(lifetimeAgg._sum.lifetimeTransactionValue),
    activityIn30Days:   toNum(activity30Agg._sum.last30DayTransactionValue),
  };
}

async function buildWalletRetention(): Promise<WalletRetentionSectionData> {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86_400_000);
  const d60 = new Date(now.getTime() - 60 * 86_400_000);
  const d90 = new Date(now.getTime() - 90 * 86_400_000);

  const [total, active30, band30to60, band60to90, dormant90] = await Promise.all([
    prisma.walletCustomerActivitySnapshot.count(),
    prisma.walletCustomerActivitySnapshot.count({ where: { lastSeenDate: { gte: d30 } } }),
    prisma.walletCustomerActivitySnapshot.count({ where: { lastSeenDate: { gte: d60, lt: d30 } } }),
    prisma.walletCustomerActivitySnapshot.count({ where: { lastSeenDate: { gte: d90, lt: d60 } } }),
    prisma.walletCustomerActivitySnapshot.count({ where: { lastSeenDate: { lt: d90 } } }),
  ]);

  return {
    type: "WALLET_RETENTION",
    asOfDate: formatDateString(now),
    totalCustomers: total,
    active30,
    inactive30to60: band30to60,
    inactive60to90: band60to90,
    dormant90plus:  dormant90,
  };
}

async function buildAlertsSummary(section: ReportSection): Promise<AlertsSummarySectionData> {
  const params = section.params as AlertsSummaryParams;
  const limit = params.limit ?? 10;
  const since = new Date(Date.now() - 7 * 86_400_000);

  const logs = await prisma.alertLog.findMany({
    where: { sentAt: { gte: since }, status: "SENT" },
    orderBy: { sentAt: "desc" },
    take: limit,
    include: {
      expense: { include: { branch: { select: { city: true, label: true } } } },
    },
  });

  return {
    type: "ALERTS_SUMMARY",
    params,
    alerts: logs.map((log) => ({
      branchName: log.expense ? `${log.expense.branch.city} - ${log.expense.branch.label}` : "Unknown",
      expenseType: log.ruleType,
      dueDate: log.expense ? formatDateString(log.expense.dueDate) : "—",
      dayOffset: log.dayOffset,
      sentAt: log.sentAt.toISOString(),
    })),
  };
}

// ─── New 8 builders ───────────────────────────────────────────────────────────

async function buildFloatPosition(
  section: ReportSection,
  branchIds: string[],
): Promise<FloatPositionSectionData> {
  const params    = section.params as FloatPositionParams;
  const threshold = params.threshold ?? 5000;
  const order     = params.order ?? "asc";

  const yesterday = getYesterday();
  const rows = await fetchBranchRows(branchIds, yesterday);

  const withStatus = rows.map((row) => ({
    branchName:    row.branchName,
    eFloatBalance: row.eFloatBalance,
    status: (row.eFloatBalance < threshold
      ? "low"
      : row.eFloatBalance < threshold * 2
        ? "ok"
        : "good") as "low" | "ok" | "good",
  }));

  withStatus.sort((a, b) =>
    order === "asc" ? a.eFloatBalance - b.eFloatBalance : b.eFloatBalance - a.eFloatBalance,
  );

  return {
    type: "FLOAT_POSITION",
    date: formatDateString(yesterday),
    params,
    threshold,
    rows: withStatus,
  };
}

async function buildTransactionTrends(
  section: ReportSection,
  branchIds: string[],
): Promise<TransactionTrendsSectionData> {
  const params = section.params as TransactionTrendsParams;
  const metric = params.metric ?? "cashIn";

  const yesterday = getYesterday();
  const sevenDaysAgo = new Date(yesterday.getTime() - 6 * 86_400_000);

  const where: Prisma.BranchMetricWhereInput = {
    metricDate: { gte: sevenDaysAgo, lte: yesterday },
  };
  if (branchIds.length > 0) {
    where.branchId = { in: branchIds.map(BigInt) };
  }

  const all = await prisma.branchMetric.findMany({
    where,
    include: { branch: { select: { city: true, label: true } } },
  });

  const byBranch = new Map<string, { name: string; days: Map<string, number> }>();

  for (const m of all) {
    const name = `${m.branch.city} - ${m.branch.label}`;
    if (!byBranch.has(name)) byBranch.set(name, { name, days: new Map() });
    const dateKey = m.metricDate.toISOString().slice(0, 10);
    const value =
      metric === "cashIn"  ? toNum(m.cashInValue)
      : metric === "cashOut" ? toNum(m.cashOutValue)
      : m.totalTransactionVolume;
    byBranch.get(name)!.days.set(dateKey, value);
  }

  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const rows = [...byBranch.values()].map(({ name, days }) => {
    const yesterdayVal = days.get(yesterdayKey) ?? 0;
    const prior = [...days.entries()]
      .filter(([k]) => k !== yesterdayKey)
      .map(([, v]) => v);
    const avg7d = prior.length > 0 ? prior.reduce((s, v) => s + v, 0) / prior.length : 0;
    const changePercent = avg7d > 0 ? ((yesterdayVal - avg7d) / avg7d) * 100 : 0;
    return { branchName: name, yesterday: yesterdayVal, avg7d, changePercent };
  });

  rows.sort((a, b) => b.yesterday - a.yesterday);

  return { type: "TRANSACTION_TRENDS", date: formatDateString(yesterday), params, rows };
}

async function buildNewCustomers(): Promise<NewCustomersSectionData> {
  const yesterday    = getYesterday();
  const sevenAgo     = new Date(yesterday.getTime() - 6 * 86_400_000);
  const monthStart   = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1);
  const nextDay      = new Date(yesterday.getTime() + 86_400_000);

  const [newYesterday, last7, thisMonth] = await Promise.all([
    prisma.walletCustomerActivitySnapshot.count({
      where: { firstSeenDate: { gte: yesterday, lt: nextDay } },
    }),
    prisma.walletCustomerActivitySnapshot.count({
      where: { firstSeenDate: { gte: sevenAgo, lt: nextDay } },
    }),
    prisma.walletCustomerActivitySnapshot.count({
      where: { firstSeenDate: { gte: monthStart, lt: nextDay } },
    }),
  ]);

  return {
    type:           "NEW_CUSTOMERS",
    date:           formatDateString(yesterday),
    newYesterday,
    avg7d:          Math.round(last7 / 7),
    totalThisMonth: thisMonth,
  };
}

async function buildTopWalletCustomers(
  section: ReportSection,
): Promise<TopWalletCustomersSectionData> {
  const params = section.params as TopWalletCustomersParams;
  const metric = params.metric ?? "last30d";
  const limit  = params.limit  ?? 10;

  const customers = await prisma.walletCustomerActivitySnapshot.findMany({
    orderBy:
      metric === "last30d"
        ? { last30DayTransactionValue: "desc" }
        : { lifetimeTransactionValue: "desc" },
    take: limit,
    select: {
      fullName:                  true,
      mobileNumber:              true,
      last30DayTransactionValue: true,
      lifetimeTransactionValue:  true,
      lifetimeTransactionVolume: true,
    },
  });

  return {
    type:      "TOP_WALLET_CUSTOMERS",
    asOfDate:  formatDateString(new Date()),
    params,
    rows: customers.map((c, i) => ({
      rank:            i + 1,
      fullName:        c.fullName ?? "—",
      mobileNumber:    c.mobileNumber ?? "—",
      value:           toNum(metric === "last30d" ? c.last30DayTransactionValue : c.lifetimeTransactionValue),
      lifetimeVolume:  c.lifetimeTransactionVolume,
    })),
  };
}

async function buildRevenueBreakdown(
  section: ReportSection,
  branchIds: string[],
): Promise<RevenueBreakdownSectionData> {
  const yesterday = getYesterday();

  const where: Prisma.BranchMetricWhereInput = { metricDate: yesterday };
  if (branchIds.length > 0) {
    where.branchId = { in: branchIds.map(BigInt) };
  }

  const metrics = await prisma.branchMetric.findMany({
    where,
    include: { branch: { select: { city: true, label: true } } },
    orderBy: [{ totalCommission: "desc" }],
  });

  const rows = metrics.map((m) => ({
    branchName:             `${m.branch.city} - ${m.branch.label}`,
    commissionOnDeposits:   toNum(m.commissionOnDeposits),
    commissionOnWithdrawals: toNum(m.commissionOnWithdrawals),
    totalCommission:        toNum(m.totalCommission),
  }));

  const totalDeposits    = rows.reduce((s, r) => s + r.commissionOnDeposits, 0);
  const totalWithdrawals = rows.reduce((s, r) => s + r.commissionOnWithdrawals, 0);
  const grandTotal       = rows.reduce((s, r) => s + r.totalCommission, 0);

  return {
    type: "REVENUE_BREAKDOWN",
    date: formatDateString(yesterday),
    totalDeposits,
    totalWithdrawals,
    grandTotal,
    rows,
  };
}

async function buildUpcomingPayments(
  section: ReportSection,
  branchIds: string[],
): Promise<UpcomingPaymentsSectionData> {
  const params    = section.params as UpcomingPaymentsParams;
  const daysAhead = params.daysAhead ?? 14;

  const today   = getTodayInHarare();
  const cutoff  = new Date(today.getTime() + daysAhead * 86_400_000);

  const where: Prisma.ExpenseWhereInput = {
    dueDate: { gte: today, lte: cutoff },
  };
  if (branchIds.length > 0) {
    where.branchId = { in: branchIds.map(BigInt) };
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { branch: { select: { city: true, label: true } } },
    orderBy: { dueDate: "asc" },
  });

  return {
    type:     "UPCOMING_PAYMENTS",
    asOfDate: formatDateString(today),
    params,
    payments: expenses.map((e) => ({
      branchName:   `${e.branch.city} - ${e.branch.label}`,
      expenseType:  e.expenseType,
      dueDate:      formatDateString(e.dueDate),
      amount:       toNum(e.amount),
      currency:     e.currency,
      daysUntilDue: daysBetween(today, e.dueDate),
    })),
  };
}

async function buildOverdueSummary(
  section: ReportSection,
  branchIds: string[],
): Promise<OverdueSummarySectionData> {
  const today = getTodayInHarare();

  const where: Prisma.ExpenseWhereInput = { dueDate: { lt: today } };
  if (branchIds.length > 0) {
    where.branchId = { in: branchIds.map(BigInt) };
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { branch: { select: { city: true, label: true } } },
    orderBy: { dueDate: "asc" },
  });

  const payments = expenses.map((e) => ({
    branchName:  `${e.branch.city} - ${e.branch.label}`,
    expenseType: e.expenseType,
    dueDate:     formatDateString(e.dueDate),
    amount:      toNum(e.amount),
    currency:    e.currency,
    daysOverdue: daysBetween(e.dueDate, today),
  }));

  return {
    type:        "OVERDUE_SUMMARY",
    asOfDate:    formatDateString(today),
    payments,
    totalAmount: payments.reduce((s, p) => s + p.amount, 0),
  };
}

async function buildWeekSnapshot(
  section: ReportSection,
  branchIds: string[],
): Promise<WeekSnapshotSectionData> {
  const params = section.params as WeekSnapshotParams;
  const metric = params.metric ?? "cashIn";

  const yesterday   = getYesterday();
  const sevenDaysAgo = new Date(yesterday.getTime() - 6 * 86_400_000);

  const where: Prisma.BranchMetricWhereInput = {
    metricDate: { gte: sevenDaysAgo, lte: yesterday },
  };
  if (branchIds.length > 0) {
    where.branchId = { in: branchIds.map(BigInt) };
  }

  const metrics = await prisma.branchMetric.findMany({ where });

  const byDay = new Map<string, { value: number; volume: number }>();
  for (const m of metrics) {
    const key = m.metricDate.toISOString().slice(0, 10);
    const existing = byDay.get(key) ?? { value: 0, volume: 0 };
    const val =
      metric === "cashIn"      ? toNum(m.cashInValue)
      : metric === "cashOut"   ? toNum(m.cashOutValue)
      : metric === "commission" ? toNum(m.totalCommission)
      : m.totalTransactionVolume;
    byDay.set(key, {
      value:  existing.value  + (metric === "volume" ? 0 : val),
      volume: existing.volume + m.totalTransactionVolume,
    });
  }

  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days: WeekSnapshotSectionData["days"] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(yesterday.getTime() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { value: 0, volume: 0 };
    days.push({
      date:     formatDateString(d),
      dayLabel: DAY_NAMES[d.getDay()],
      value:    metric === "volume" ? entry.volume : entry.value,
      volume:   entry.volume,
    });
  }

  const grandValue  = days.reduce((s, d) => s + d.value,  0);
  const grandVolume = days.reduce((s, d) => s + d.volume, 0);

  return { type: "WEEK_SNAPSHOT", params, days, grandValue, grandVolume };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function buildSectionData(
  section: ReportSection,
  branchIds: string[],
): Promise<SectionData> {
  switch (section.type) {
    case "BRANCH_PERFORMANCE":   return buildBranchPerformance(section, branchIds);
    case "TOP_PERFORMERS":       return buildTopPerformers(section, branchIds);
    case "WALLET_SUMMARY":       return buildWalletSummary();
    case "WALLET_RETENTION":     return buildWalletRetention();
    case "ALERTS_SUMMARY":       return buildAlertsSummary(section);
    case "FLOAT_POSITION":       return buildFloatPosition(section, branchIds);
    case "TRANSACTION_TRENDS":   return buildTransactionTrends(section, branchIds);
    case "NEW_CUSTOMERS":        return buildNewCustomers();
    case "TOP_WALLET_CUSTOMERS": return buildTopWalletCustomers(section);
    case "REVENUE_BREAKDOWN":    return buildRevenueBreakdown(section, branchIds);
    case "UPCOMING_PAYMENTS":    return buildUpcomingPayments(section, branchIds);
    case "OVERDUE_SUMMARY":      return buildOverdueSummary(section, branchIds);
    case "WEEK_SNAPSHOT":        return buildWeekSnapshot(section, branchIds);
    default:
      throw new Error(`Unknown section type: ${(section as ReportSection).type}`);
  }
}

export async function buildAllSectionsData(
  sections: ReportSection[],
  branchIds: string[],
): Promise<SectionData[]> {
  return Promise.all(sections.map((s) => buildSectionData(s, branchIds)));
}
