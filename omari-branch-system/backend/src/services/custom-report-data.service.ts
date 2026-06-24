import { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma";
import { getTodayInHarare, formatDateString } from "./alert-evaluation.service";
import type {
  ReportSection,
  BranchPerformanceParams,
  TopPerformersParams,
  AlertsSummaryParams,
  BranchRow,
  BranchPerformanceSectionData,
  TopPerformersSectionData,
  WalletSummarySectionData,
  WalletRetentionSectionData,
  AlertsSummarySectionData,
  SectionData,
} from "./custom-report-types";

function getYesterday(): Date {
  const today = getTodayInHarare();
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

function toNum(val: Prisma.Decimal | number | string): number {
  return Number(new Prisma.Decimal(val).toFixed(2));
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
    let av = 0;
    let bv = 0;
    if (sortBy === "branchName") {
      return order === "asc" ? a.branchName.localeCompare(b.branchName) : b.branchName.localeCompare(a.branchName);
    }
    if (sortBy === "cashIn") { av = a.cashInValue; bv = b.cashInValue; }
    else if (sortBy === "cashOut") { av = a.cashOutValue; bv = b.cashOutValue; }
    else if (sortBy === "eFloat") { av = a.eFloatBalance; bv = b.eFloatBalance; }
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
  const limit = params.limit ?? 10;
  const order = params.order ?? "desc";

  const yesterday = getYesterday();
  const rows = await fetchBranchRows(branchIds, yesterday);

  const sorted = [...rows].sort((a, b) => {
    let av = 0;
    let bv = 0;
    if (metric === "cashIn") { av = a.cashInValue; bv = b.cashInValue; }
    else if (metric === "cashOut") { av = a.cashOutValue; bv = b.cashOutValue; }
    else if (metric === "eFloat") { av = a.eFloatBalance; bv = b.eFloatBalance; }
    else if (metric === "commission") { av = a.totalCommission; bv = b.totalCommission; }
    return order === "asc" ? av - bv : bv - av;
  });

  const top = sorted.slice(0, limit).map((row, i) => ({
    rank: i + 1,
    branchName: row.branchName,
    value:
      metric === "cashIn" ? row.cashInValue
      : metric === "cashOut" ? row.cashOutValue
      : metric === "eFloat" ? row.eFloatBalance
      : row.totalCommission,
  }));

  return { type: "TOP_PERFORMERS", date: formatDateString(yesterday), params, rows: top };
}

async function buildWalletSummary(): Promise<WalletSummarySectionData> {
  const now = new Date();
  const cutoff30 = new Date(now.getTime() - 30 * 86_400_000);
  const cutoff90 = new Date(now.getTime() - 90 * 86_400_000);

  const [total, active30, newIn30, dormant90, lifetimeAgg, activity30Agg] = await Promise.all([
    prisma.walletCustomerActivitySnapshot.count(),
    prisma.walletCustomerActivitySnapshot.count({ where: { lastSeenDate: { gte: cutoff30 } } }),
    prisma.walletCustomerActivitySnapshot.count({ where: { firstSeenDate: { gte: cutoff30 } } }),
    prisma.walletCustomerActivitySnapshot.count({ where: { lastSeenDate: { lt: cutoff90 } } }),
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
    totalLifetimeValue: toNum(lifetimeAgg._sum.lifetimeTransactionValue ?? 0),
    activityIn30Days: toNum(activity30Agg._sum.last30DayTransactionValue ?? 0),
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
    dormant90plus: dormant90,
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
      expense: {
        include: { branch: { select: { city: true, label: true } } },
      },
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

export async function buildSectionData(
  section: ReportSection,
  branchIds: string[],
): Promise<SectionData> {
  switch (section.type) {
    case "BRANCH_PERFORMANCE":
      return buildBranchPerformance(section, branchIds);
    case "TOP_PERFORMERS":
      return buildTopPerformers(section, branchIds);
    case "WALLET_SUMMARY":
      return buildWalletSummary();
    case "WALLET_RETENTION":
      return buildWalletRetention();
    case "ALERTS_SUMMARY":
      return buildAlertsSummary(section);
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
