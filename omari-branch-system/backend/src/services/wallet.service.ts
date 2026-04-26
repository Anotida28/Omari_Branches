import { Prisma } from "@prisma/client";
import sql from "mssql";

import { env } from "../config/env";
import { prisma } from "../db/prisma";

export class WalletServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "WalletServiceError";
  }
}

type QualifiedTableName = {
  schema: string;
  table: string;
};

export type WalletOverviewInput = {
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
  compare: boolean;
};

type WalletKpis = {
  totalTransactionValue: number;
  totalTransactionVolume: number;
  totalCommission: number;
  activeCustomersA30: number;
  activeCustomersA60: number;
  newCustomers: number;
  dormantCustomers90Plus: number | null;
  latestTotalEFloat: number;
  latestEFloatDate: string | null;
};

type WalletComparisonKpi = {
  previousValue: number;
  absoluteChange: number;
  percentChange: number | null;
};

export type WalletOverviewResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
    asOfDate: string;
  };
  kpis: WalletKpis;
  comparison: {
    previousPeriodDateFrom: string;
    previousPeriodDateTo: string;
    kpis: Record<Exclude<keyof WalletKpis, "latestEFloatDate" | "dormantCustomers90Plus">, WalletComparisonKpi> & {
      dormantCustomers90Plus: WalletComparisonKpi | null;
    };
  } | null;
  metadata: {
    currency: "USD";
    dataFreshnessTimestamp: string;
    sourceSummaryTable: string;
    sourceBalanceTable: string;
    sourceBalanceCurrentTable: string;
  };
};

export type WalletCustomerActivityGrowthInput = {
  dateFrom: Date;
  dateTo: Date;
};

export type WalletCustomerActivityTrendPoint = {
  period: string;
  activeCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  transactionVolume: number;
};

export type WalletCustomerFrequencyBucket = {
  bucket: "1 tx" | "2-5 tx" | "6-20 tx" | "20+ tx";
  customers: number;
};

export type WalletCustomerActivityGrowthResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
  };
  kpis: {
    activeCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    transactionVolume: number;
    averageTransactionsPerActiveCustomer: number;
  };
  dailyTrend: WalletCustomerActivityTrendPoint[];
  monthlyTrend: WalletCustomerActivityTrendPoint[];
  frequencyBuckets: WalletCustomerFrequencyBucket[];
  metadata: {
    dataFreshnessTimestamp: string;
    snapshotRefreshedAt: string | null;
    sourceSummaryTable: string;
  };
};

export type WalletRetentionDormancyInput = {
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
};

export type WalletInactivityBucket = {
  bucket: "0-7 days" | "8-30 days" | "31-60 days" | "61-90 days" | "90+ days";
  customers: number;
};

export type WalletReactivationTrendPoint = {
  period: string;
  reactivatedCustomers: number;
};

export type WalletRetentionCohort = {
  cohortMonth: string;
  customers: number;
  active30Customers: number;
  dormant90Customers: number;
  active30Rate: number;
  dormant90Rate: number;
};

export type WalletRetentionDormancyResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
    asOfDate: string;
  };
  kpis: {
    activeCustomersA30: number;
    dormantCustomers90Plus: number;
    dormancyRate: number;
    reactivatedCustomers: number;
  };
  inactivityBuckets: WalletInactivityBucket[];
  reactivationTrend: WalletReactivationTrendPoint[];
  cohorts: WalletRetentionCohort[];
  metadata: {
    dataFreshnessTimestamp: string;
    snapshotRefreshedAt: string | null;
  };
};

export type WalletTransactionPerformanceInput = {
  dateFrom: Date;
  dateTo: Date;
};

export type WalletTransactionTrendPoint = {
  period: string;
  depositValue: number;
  withdrawalValue: number;
  netFlowValue: number;
  depositVolume: number;
  withdrawalVolume: number;
  totalTransactionValue: number;
  totalTransactionVolume: number;
  activeCustomers: number;
  valuePerActiveCustomer: number;
  volumePerActiveCustomer: number;
};

export type WalletTransactionPerformanceResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
  };
  kpis: {
    depositValue: number;
    withdrawalValue: number;
    netFlowValue: number;
    depositVolume: number;
    withdrawalVolume: number;
    totalTransactionValue: number;
    totalTransactionVolume: number;
    activeCustomers: number;
    valuePerActiveCustomer: number;
    volumePerActiveCustomer: number;
  };
  dailyTrend: WalletTransactionTrendPoint[];
  monthlyTrend: WalletTransactionTrendPoint[];
  metadata: {
    dataFreshnessTimestamp: string;
    sourceSummaryTable: string;
  };
};

export type WalletRevenuePerformanceInput = {
  dateFrom: Date;
  dateTo: Date;
};

export type WalletRevenueTrendPoint = {
  period: string;
  totalCommission: number;
  depositCommission: number;
  withdrawalCommission: number;
  totalTransactionValue: number;
  totalTransactionVolume: number;
  activeCustomers: number;
  commissionPerTransaction: number;
  commissionPerActiveCustomer: number;
  commissionRate: number;
};

export type WalletRevenuePerformanceResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
  };
  kpis: {
    totalCommission: number;
    depositCommission: number;
    withdrawalCommission: number;
    totalTransactionValue: number;
    totalTransactionVolume: number;
    activeCustomers: number;
    commissionPerTransaction: number;
    commissionPerActiveCustomer: number;
    commissionRate: number;
  };
  dailyTrend: WalletRevenueTrendPoint[];
  monthlyTrend: WalletRevenueTrendPoint[];
  metadata: {
    dataFreshnessTimestamp: string;
    sourceSummaryTable: string;
  };
};

export type WalletLiquidityInput = {
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
};

export type WalletLiquidityTrendPoint = {
  period: string;
  totalEFloat: number;
  averageBalance: number;
  accountCount: number;
  lowBalanceAccounts: number;
  zeroOrNegativeAccounts: number;
};

export type WalletLiquidityProductBreakdownItem = {
  accountProduct: string;
  accountCount: number;
  totalEFloat: number;
  averageBalance: number;
  lowBalanceAccounts: number;
};

export type WalletLiquidityResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
    asOfDate: string;
  };
  kpis: {
    latestTotalEFloat: number;
    latestEFloatDate: string | null;
    accountCount: number;
    lowBalanceAccounts: number;
    zeroOrNegativeAccounts: number;
    averageBalance: number;
    medianBalance: number;
    top10BalanceConcentration: number;
  };
  dailyTrend: WalletLiquidityTrendPoint[];
  productBreakdown: WalletLiquidityProductBreakdownItem[];
  metadata: {
    dataFreshnessTimestamp: string;
    sourceBalanceCurrentTable: string;
    lowBalanceThreshold: number;
  };
};

export type WalletCustomer360ListInput = {
  search?: string;
  status?: "all" | "active_a30" | "dormant_90";
  page: number;
  pageSize: number;
  asOfDate: Date;
};

export type WalletCustomer360Summary = {
  customerId: string;
  fullName: string | null;
  mobileNumber: string | null;
  firstSeenDate: string;
  lastSeenDate: string;
  daysSinceLastActivity: number;
  dormancyStatus: "active" | "watch" | "dormant";
  lifetimeTransactionValue: number;
  lifetimeTransactionVolume: number;
  lifetimeCommission: number;
  last30DayTransactionValue: number;
  last60DayTransactionValue: number;
};

export type WalletCustomer360ListResponse = {
  items: WalletCustomer360Summary[];
  page: number;
  pageSize: number;
  total: number;
  metadata: {
    dataFreshnessTimestamp: string;
    snapshotRefreshedAt: string | null;
  };
};

export type WalletCustomer360DetailInput = {
  customerId: string;
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
};

export type WalletCustomer360TrendPoint = {
  period: string;
  transactionValue: number;
  transactionVolume: number;
  commission: number;
  depositValue: number;
  withdrawalValue: number;
};

export type WalletCustomer360DetailResponse = {
  customer: WalletCustomer360Summary;
  kpis: {
    selectedPeriodTransactionValue: number;
    selectedPeriodTransactionVolume: number;
    selectedPeriodCommission: number;
    last90DayTransactionValue: number;
    last90DayTransactionVolume: number;
    averageTransactionValue: number;
  };
  dailyTrend: WalletCustomer360TrendPoint[];
  metadata: {
    dataFreshnessTimestamp: string;
    sourceSummaryTable: string;
    snapshotRefreshedAt: string | null;
  };
};

export type WalletInsightsAlertsInput = {
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
};

export type WalletInsightAlertSeverity = "critical" | "warning" | "positive" | "info";
export type WalletInsightAlertCategory =
  | "growth"
  | "activity"
  | "dormancy"
  | "revenue"
  | "liquidity"
  | "cash_flow";

export type WalletInsightAlertItem = {
  id: string;
  severity: WalletInsightAlertSeverity;
  category: WalletInsightAlertCategory;
  title: string;
  metricLabel: string;
  metricValue: number;
  thresholdLabel: string;
  message: string;
  suggestedAction: string;
};

export type WalletInsightsAlertsResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
    asOfDate: string;
  };
  summary: {
    criticalCount: number;
    warningCount: number;
    positiveCount: number;
    infoCount: number;
    totalAlerts: number;
  };
  alerts: WalletInsightAlertItem[];
  metadata: {
    dataFreshnessTimestamp: string;
    sourceSummaryTable: string;
    sourceBalanceCurrentTable: string;
  };
};

type NumericRecord = Record<string, unknown>;

const LOW_BALANCE_THRESHOLD = 100;

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function parseQualifiedTableName(value: string): QualifiedTableName {
  const [schema, table] = value.split(".");
  return { schema, table };
}

function normalizeDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date): number {
  const startDate = normalizeDateOnly(start);
  const endDate = normalizeDateOnly(end);
  return Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000));
}

function getDormancyStatus(daysSinceLastActivity: number): WalletCustomer360Summary["dormancyStatus"] {
  if (daysSinceLastActivity > 90) {
    return "dormant";
  }
  if (daysSinceLastActivity > 30) {
    return "watch";
  }
  return "active";
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getPrismaErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return null;
}

function getSourceConfig(): sql.config {
  return {
    server: env.SOURCE_SQL_SERVER ?? "",
    port: env.SOURCE_SQL_PORT,
    database: env.SOURCE_SQL_DATABASE ?? "",
    user: env.SOURCE_SQL_USER ?? "",
    password: env.SOURCE_SQL_PASSWORD ?? "",
    options: {
      encrypt: env.SOURCE_SQL_ENCRYPT,
      trustServerCertificate: env.SOURCE_SQL_TRUST_SERVER_CERTIFICATE,
      serverName: env.SOURCE_SQL_TLS_SERVER_NAME,
    },
    connectionTimeout: env.SOURCE_SQL_CONNECT_TIMEOUT_MS,
    requestTimeout: env.SOURCE_SQL_REQUEST_TIMEOUT_MS,
  };
}

function ensureSourceConfigured(): void {
  if (
    !env.SOURCE_SQL_SERVER ||
    !env.SOURCE_SQL_DATABASE ||
    !env.SOURCE_SQL_USER ||
    !env.SOURCE_SQL_PASSWORD
  ) {
    throw new WalletServiceError(
      "Source SQL metrics connection is not configured.",
      503,
    );
  }
}

async function getPool(): Promise<sql.ConnectionPool> {
  ensureSourceConfigured();

  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(getSourceConfig())
      .connect()
      .catch((error: unknown) => {
        poolPromise = null;
        throw error;
      });
  }

  return poolPromise;
}

async function queryTransactionKpis(params: {
  table: QualifiedTableName;
  dateFrom: Date;
  dateTo: Date;
}): Promise<Pick<WalletKpis, "totalTransactionValue" | "totalTransactionVolume" | "totalCommission">> {
  const pool = await getPool();
  const request = pool.request();
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const result = await request.query(`
    SELECT
      COALESCE(SUM(COALESCE([total_value], 0)), 0) AS totalTransactionValue,
      COALESCE(SUM(COALESCE([total_volume], 0)), 0) AS totalTransactionVolume,
      COALESCE(SUM(COALESCE([total_commission], 0)), 0) AS totalCommission
    FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
    WHERE CAST([date_id] AS DATE) >= @dateFrom
      AND CAST([date_id] AS DATE) <= @dateTo
  `);

  const row = (result.recordset[0] ?? {}) as NumericRecord;
  return {
    totalTransactionValue: toNumber(row.totalTransactionValue),
    totalTransactionVolume: Math.trunc(toNumber(row.totalTransactionVolume)),
    totalCommission: toNumber(row.totalCommission),
  };
}

async function queryCustomerKpis(params: {
  table: QualifiedTableName;
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
}): Promise<Pick<WalletKpis, "activeCustomersA30" | "activeCustomersA60" | "newCustomers" | "dormantCustomers90Plus">> {
  try {
    return await queryCustomerKpisFromSnapshot(params);
  } catch (error) {
    if (getPrismaErrorCode(error) !== "P2010") {
      throw error;
    }

    return queryCustomerKpisFromSource(params);
  }
}

async function queryCustomerKpisFromSnapshot(params: {
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
}): Promise<Pick<WalletKpis, "activeCustomersA30" | "activeCustomersA60" | "newCustomers" | "dormantCustomers90Plus">> {
  const a30Date = addDays(params.asOfDate, -29);
  const a60Date = addDays(params.asOfDate, -59);
  const dormantCutoff = addDays(params.asOfDate, -90);

  const rows = await prisma.$queryRaw<Array<{
    activeCustomersA30: bigint | number;
    activeCustomersA60: bigint | number;
    newCustomers: bigint | number;
    dormantCustomers90Plus: bigint | number;
  }>>`
    SELECT
      SUM(CASE WHEN [lastSeenDate] >= ${a30Date} AND [lastSeenDate] <= ${params.asOfDate} THEN 1 ELSE 0 END) AS [activeCustomersA30],
      SUM(CASE WHEN [lastSeenDate] >= ${a60Date} AND [lastSeenDate] <= ${params.asOfDate} THEN 1 ELSE 0 END) AS [activeCustomersA60],
      SUM(CASE WHEN [firstSeenDate] >= ${params.dateFrom} AND [firstSeenDate] <= ${params.dateTo} THEN 1 ELSE 0 END) AS [newCustomers],
      SUM(CASE WHEN [lastSeenDate] < ${dormantCutoff} THEN 1 ELSE 0 END) AS [dormantCustomers90Plus]
    FROM [WalletCustomerActivitySnapshot]
    WHERE [firstSeenDate] <= ${params.asOfDate}
  `;

  const row = rows[0] ?? {};
  return {
    activeCustomersA30: Math.trunc(toNumber(row.activeCustomersA30)),
    activeCustomersA60: Math.trunc(toNumber(row.activeCustomersA60)),
    newCustomers: Math.trunc(toNumber(row.newCustomers)),
    dormantCustomers90Plus: Math.trunc(toNumber(row.dormantCustomers90Plus)),
  };
}

async function queryCustomerKpisFromSource(params: {
  table: QualifiedTableName;
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
}): Promise<Pick<WalletKpis, "activeCustomersA30" | "activeCustomersA60" | "newCustomers" | "dormantCustomers90Plus">> {
  const pool = await getPool();
  const activeA30Request = pool.request();
  activeA30Request.input("a30Date", sql.Date, addDays(params.asOfDate, -29));
  activeA30Request.input("asOfDate", sql.Date, params.asOfDate);

  const activeA60Request = pool.request();
  activeA60Request.input("a60Date", sql.Date, addDays(params.asOfDate, -59));
  activeA60Request.input("asOfDate", sql.Date, params.asOfDate);

  const newCustomersRequest = pool.request();
  newCustomersRequest.input("dateFrom", sql.Date, params.dateFrom);
  newCustomersRequest.input("dateTo", sql.Date, params.dateTo);

  const [activeA30Result, activeA60Result, newCustomersResult] = await Promise.all([
    activeA30Request.query(`
      SELECT COUNT(DISTINCT LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120))))) AS activeCustomersA30
      FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
      WHERE [date_id] >= @a30Date
        AND [date_id] <= @asOfDate
        AND [customer_id] IS NOT NULL
        AND LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) <> ''
    `),
    activeA60Request.query(`
      SELECT COUNT(DISTINCT LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120))))) AS activeCustomersA60
      FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
      WHERE [date_id] >= @a60Date
        AND [date_id] <= @asOfDate
        AND [customer_id] IS NOT NULL
        AND LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) <> ''
    `),
    newCustomersRequest.query(`
      SELECT COUNT(*) AS newCustomers
      FROM (
        SELECT
          LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) AS customerId,
          MIN([date_id]) AS firstDate
        FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
        WHERE [date_id] <= @dateTo
          AND [customer_id] IS NOT NULL
          AND LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) <> ''
        GROUP BY LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120))))
      ) customer_first_seen
      WHERE firstDate >= @dateFrom
        AND firstDate <= @dateTo
    `),
  ]);

  const activeA30Row = (activeA30Result.recordset[0] ?? {}) as NumericRecord;
  const activeA60Row = (activeA60Result.recordset[0] ?? {}) as NumericRecord;
  const newCustomersRow = (newCustomersResult.recordset[0] ?? {}) as NumericRecord;
  return {
    activeCustomersA30: Math.trunc(toNumber(activeA30Row.activeCustomersA30)),
    activeCustomersA60: Math.trunc(toNumber(activeA60Row.activeCustomersA60)),
    newCustomers: Math.trunc(toNumber(newCustomersRow.newCustomers)),
    dormantCustomers90Plus: null,
  };
}

async function queryLatestEFloat(params: {
  table: QualifiedTableName;
  asOfDate: Date;
}): Promise<{ latestTotalEFloat: number; latestEFloatDate: string | null }> {
  const pool = await getPool();
  const request = pool.request();
  request.input("asOfDate", sql.Date, params.asOfDate);

  const result = await request.query(`
    DECLARE @snapshotDate DATE;

    SELECT TOP 1 @snapshotDate = CAST([balance_date] AS DATE)
    FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
    WHERE [balance_date] <= @asOfDate
    ORDER BY [balance_date] DESC;

    SELECT
      COALESCE(SUM(COALESCE([available_balance], 0)), 0) AS latestTotalEFloat,
      @snapshotDate AS latestEFloatDate
    FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
    WHERE [balance_date] >= @snapshotDate
      AND [balance_date] < DATEADD(DAY, 1, @snapshotDate)
  `);

  const row = (result.recordset[0] ?? {}) as NumericRecord;
  const snapshotDate = row.latestEFloatDate;

  return {
    latestTotalEFloat: toNumber(row.latestTotalEFloat),
    latestEFloatDate: snapshotDate instanceof Date ? formatDate(snapshotDate) : null,
  };
}

async function queryEFloatWithFallback(params: {
  currentTable: QualifiedTableName;
  historicalTable: QualifiedTableName;
  asOfDate: Date;
}): Promise<{ latestTotalEFloat: number; latestEFloatDate: string | null }> {
  const fromCurrent = await queryLatestEFloat({
    table: params.currentTable,
    asOfDate: params.asOfDate,
  });

  if (fromCurrent.latestEFloatDate) {
    return fromCurrent;
  }

  return queryLatestEFloat({
    table: params.historicalTable,
    asOfDate: params.asOfDate,
  });
}

function buildComparisonKpi(current: number, previous: number): WalletComparisonKpi {
  const absoluteChange = current - previous;
  const percentChange = previous === 0 ? null : (absoluteChange / previous) * 100;

  return {
    previousValue: previous,
    absoluteChange,
    percentChange,
  };
}

function makePeriodMap(
  rows: Array<Record<string, unknown>>,
): Map<string, { newCustomers: number }> {
  return new Map(
    rows.map((row) => [
      String(row.period),
      { newCustomers: Math.trunc(toNumber(row.newCustomers)) },
    ]),
  );
}

async function queryNewCustomerTrendFromSnapshot(params: {
  dateFrom: Date;
  dateTo: Date;
  grain: "daily" | "monthly";
}): Promise<Map<string, { newCustomers: number }>> {
  try {
    const periodSql =
      params.grain === "daily"
        ? Prisma.sql`CONVERT(VARCHAR(10), [firstSeenDate], 23)`
        : Prisma.sql`CONVERT(CHAR(7), [firstSeenDate], 120)`;

    const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        ${periodSql} AS [period],
        COUNT(*) AS [newCustomers]
      FROM [WalletCustomerActivitySnapshot]
      WHERE [firstSeenDate] >= ${params.dateFrom}
        AND [firstSeenDate] <= ${params.dateTo}
      GROUP BY ${periodSql}
      ORDER BY [period] ASC
    `;

    return makePeriodMap(rows);
  } catch (error) {
    if (getPrismaErrorCode(error) !== "P2010") {
      throw error;
    }

    return new Map();
  }
}

async function getSnapshotRefreshedAt(): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ refreshedAt: Date | null }>>`
      SELECT MAX([refreshedAt]) AS [refreshedAt]
      FROM [WalletCustomerActivitySnapshot]
    `;

    const refreshedAt = rows[0]?.refreshedAt;
    return refreshedAt instanceof Date ? refreshedAt.toISOString() : null;
  } catch (error) {
    if (getPrismaErrorCode(error) !== "P2010") {
      throw error;
    }

    return null;
  }
}

async function queryRetentionDormancyFromSnapshot(params: {
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
}): Promise<{
  activeCustomersA30: number;
  dormantCustomers90Plus: number;
  totalCustomers: number;
  inactivityBuckets: WalletInactivityBucket[];
  reactivationTrend: WalletReactivationTrendPoint[];
  cohorts: WalletRetentionCohort[];
}> {
  const a30Date = addDays(params.asOfDate, -29);
  const dormantCutoff = addDays(params.asOfDate, -90);

  const [summaryRows, bucketRows, reactivationRows, cohortRows] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        COUNT(*) AS [totalCustomers],
        SUM(CASE WHEN [lastSeenDate] >= ${a30Date} AND [lastSeenDate] <= ${params.asOfDate} THEN 1 ELSE 0 END) AS [activeCustomersA30],
        SUM(CASE WHEN [lastSeenDate] < ${dormantCutoff} THEN 1 ELSE 0 END) AS [dormantCustomers90Plus]
      FROM [WalletCustomerActivitySnapshot]
      WHERE [firstSeenDate] <= ${params.asOfDate}
    `,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        [bucket],
        COUNT(*) AS [customers]
      FROM (
        SELECT
          CASE
            WHEN DATEDIFF(DAY, [lastSeenDate], ${params.asOfDate}) BETWEEN 0 AND 7 THEN '0-7 days'
            WHEN DATEDIFF(DAY, [lastSeenDate], ${params.asOfDate}) BETWEEN 8 AND 30 THEN '8-30 days'
            WHEN DATEDIFF(DAY, [lastSeenDate], ${params.asOfDate}) BETWEEN 31 AND 60 THEN '31-60 days'
            WHEN DATEDIFF(DAY, [lastSeenDate], ${params.asOfDate}) BETWEEN 61 AND 90 THEN '61-90 days'
            ELSE '90+ days'
          END AS [bucket]
        FROM [WalletCustomerActivitySnapshot]
        WHERE [firstSeenDate] <= ${params.asOfDate}
      ) bucketed_customers
      GROUP BY [bucket]
    `,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        CONVERT(VARCHAR(10), [lastSeenDate], 23) AS [period],
        COUNT(*) AS [reactivatedCustomers]
      FROM [WalletCustomerActivitySnapshot]
      WHERE [lastSeenDate] >= ${params.dateFrom}
        AND [lastSeenDate] <= ${params.dateTo}
        AND DATEDIFF(DAY, [firstSeenDate], [lastSeenDate]) > 90
      GROUP BY CONVERT(VARCHAR(10), [lastSeenDate], 23)
      ORDER BY [period] ASC
    `,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        CONVERT(CHAR(7), [firstSeenDate], 120) AS [cohortMonth],
        COUNT(*) AS [customers],
        SUM(CASE WHEN [lastSeenDate] >= ${a30Date} AND [lastSeenDate] <= ${params.asOfDate} THEN 1 ELSE 0 END) AS [active30Customers],
        SUM(CASE WHEN [lastSeenDate] < ${dormantCutoff} THEN 1 ELSE 0 END) AS [dormant90Customers]
      FROM [WalletCustomerActivitySnapshot]
      WHERE [firstSeenDate] <= ${params.asOfDate}
      GROUP BY CONVERT(CHAR(7), [firstSeenDate], 120)
      ORDER BY [cohortMonth] DESC
    `,
  ]);

  const summary = summaryRows[0] ?? {};
  const totalCustomers = Math.trunc(toNumber(summary.totalCustomers));
  const byBucket = new Map(
    bucketRows.map((row) => [String(row.bucket), Math.trunc(toNumber(row.customers))]),
  );

  return {
    activeCustomersA30: Math.trunc(toNumber(summary.activeCustomersA30)),
    dormantCustomers90Plus: Math.trunc(toNumber(summary.dormantCustomers90Plus)),
    totalCustomers,
    inactivityBuckets: ([
      "0-7 days",
      "8-30 days",
      "31-60 days",
      "61-90 days",
      "90+ days",
    ] as const).map((bucket) => ({
      bucket,
      customers: byBucket.get(bucket) ?? 0,
    })),
    reactivationTrend: reactivationRows.map((row) => ({
      period: String(row.period),
      reactivatedCustomers: Math.trunc(toNumber(row.reactivatedCustomers)),
    })),
    cohorts: cohortRows.map((row) => {
      const customers = Math.trunc(toNumber(row.customers));
      const active30Customers = Math.trunc(toNumber(row.active30Customers));
      const dormant90Customers = Math.trunc(toNumber(row.dormant90Customers));

      return {
        cohortMonth: String(row.cohortMonth),
        customers,
        active30Customers,
        dormant90Customers,
        active30Rate: customers === 0 ? 0 : (active30Customers / customers) * 100,
        dormant90Rate: customers === 0 ? 0 : (dormant90Customers / customers) * 100,
      };
    }),
  };
}

async function queryActivityTrendFromSource(params: {
  table: QualifiedTableName;
  dateFrom: Date;
  dateTo: Date;
  grain: "daily" | "monthly";
}): Promise<Array<{ period: string; activeCustomers: number; transactionVolume: number }>> {
  const pool = await getPool();
  const request = pool.request();
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const periodExpression =
    params.grain === "daily"
      ? "CONVERT(VARCHAR(10), CAST([date_id] AS DATE), 23)"
      : "CONVERT(CHAR(7), CAST([date_id] AS DATE), 120)";

  const result = await request.query(`
    SELECT
      ${periodExpression} AS [period],
      COUNT(DISTINCT LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120))))) AS [activeCustomers],
      COALESCE(SUM(COALESCE([total_volume], 0)), 0) AS [transactionVolume]
    FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
    WHERE [date_id] >= @dateFrom
      AND [date_id] <= @dateTo
      AND [customer_id] IS NOT NULL
      AND LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) <> ''
    GROUP BY ${periodExpression}
    ORDER BY [period] ASC
  `);

  return (result.recordset as Array<Record<string, unknown>>).map((row) => ({
    period: String(row.period),
    activeCustomers: Math.trunc(toNumber(row.activeCustomers)),
    transactionVolume: Math.trunc(toNumber(row.transactionVolume)),
  }));
}

async function queryFrequencyBucketsFromSource(params: {
  table: QualifiedTableName;
  dateFrom: Date;
  dateTo: Date;
}): Promise<WalletCustomerFrequencyBucket[]> {
  const pool = await getPool();
  const request = pool.request();
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const result = await request.query(`
    WITH customer_frequency AS (
      SELECT
        LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) AS [customerId],
        COALESCE(SUM(COALESCE([total_volume], 0)), 0) AS [transactionCount]
      FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
      WHERE [date_id] >= @dateFrom
        AND [date_id] <= @dateTo
        AND [customer_id] IS NOT NULL
        AND LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) <> ''
      GROUP BY LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120))))
    )
    SELECT
      CASE
        WHEN [transactionCount] <= 1 THEN '1 tx'
        WHEN [transactionCount] BETWEEN 2 AND 5 THEN '2-5 tx'
        WHEN [transactionCount] BETWEEN 6 AND 20 THEN '6-20 tx'
        ELSE '20+ tx'
      END AS [bucket],
      COUNT(*) AS [customers]
    FROM customer_frequency
    GROUP BY
      CASE
        WHEN [transactionCount] <= 1 THEN '1 tx'
        WHEN [transactionCount] BETWEEN 2 AND 5 THEN '2-5 tx'
        WHEN [transactionCount] BETWEEN 6 AND 20 THEN '6-20 tx'
        ELSE '20+ tx'
      END
  `);

  const byBucket = new Map(
    (result.recordset as Array<Record<string, unknown>>).map((row) => [
      String(row.bucket),
      Math.trunc(toNumber(row.customers)),
    ]),
  );

  return (["1 tx", "2-5 tx", "6-20 tx", "20+ tx"] as const).map((bucket) => ({
    bucket,
    customers: byBucket.get(bucket) ?? 0,
  }));
}

function mergeActivityTrend(
  activeRows: Array<{ period: string; activeCustomers: number; transactionVolume: number }>,
  newCustomersByPeriod: Map<string, { newCustomers: number }>,
): WalletCustomerActivityTrendPoint[] {
  const periods = new Set([
    ...activeRows.map((row) => row.period),
    ...Array.from(newCustomersByPeriod.keys()),
  ]);
  const activeByPeriod = new Map(activeRows.map((row) => [row.period, row]));

  return Array.from(periods)
    .sort((left, right) => left.localeCompare(right))
    .map((period) => {
      const active = activeByPeriod.get(period);
      const newCustomers = newCustomersByPeriod.get(period)?.newCustomers ?? 0;
      const activeCustomers = active?.activeCustomers ?? 0;

      return {
        period,
        activeCustomers,
        newCustomers,
        returningCustomers: Math.max(0, activeCustomers - newCustomers),
        transactionVolume: active?.transactionVolume ?? 0,
      };
    });
}

async function queryTransactionPerformanceTrend(params: {
  table: QualifiedTableName;
  dateFrom: Date;
  dateTo: Date;
  grain: "daily" | "monthly";
}): Promise<WalletTransactionTrendPoint[]> {
  const pool = await getPool();
  const request = pool.request();
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const periodExpression =
    params.grain === "daily"
      ? "CONVERT(VARCHAR(10), CAST([date_id] AS DATE), 23)"
      : "CONVERT(CHAR(7), CAST([date_id] AS DATE), 120)";

  const result = await request.query(`
    SELECT
      ${periodExpression} AS [period],
      COALESCE(SUM(COALESCE([value_of_deposits], 0)), 0) AS [depositValue],
      COALESCE(SUM(COALESCE([value_of_withdrawals], 0)), 0) AS [withdrawalValue],
      COALESCE(SUM(COALESCE([number_of_deposits], 0)), 0) AS [depositVolume],
      COALESCE(SUM(COALESCE([number_of_withdrawals], 0)), 0) AS [withdrawalVolume],
      COALESCE(SUM(COALESCE([total_value], 0)), 0) AS [totalTransactionValue],
      COALESCE(SUM(COALESCE([total_volume], 0)), 0) AS [totalTransactionVolume],
      COUNT(DISTINCT LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120))))) AS [activeCustomers]
    FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
    WHERE [date_id] >= @dateFrom
      AND [date_id] <= @dateTo
      AND [customer_id] IS NOT NULL
      AND LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) <> ''
    GROUP BY ${periodExpression}
    ORDER BY [period] ASC
  `);

  return (result.recordset as Array<Record<string, unknown>>).map((row) => {
    const activeCustomers = Math.trunc(toNumber(row.activeCustomers));
    const totalTransactionValue = toNumber(row.totalTransactionValue);
    const totalTransactionVolume = Math.trunc(toNumber(row.totalTransactionVolume));
    const depositValue = toNumber(row.depositValue);
    const withdrawalValue = toNumber(row.withdrawalValue);

    return {
      period: String(row.period),
      depositValue,
      withdrawalValue,
      netFlowValue: depositValue - withdrawalValue,
      depositVolume: Math.trunc(toNumber(row.depositVolume)),
      withdrawalVolume: Math.trunc(toNumber(row.withdrawalVolume)),
      totalTransactionValue,
      totalTransactionVolume,
      activeCustomers,
      valuePerActiveCustomer:
        activeCustomers === 0 ? 0 : totalTransactionValue / activeCustomers,
      volumePerActiveCustomer:
        activeCustomers === 0 ? 0 : totalTransactionVolume / activeCustomers,
    };
  });
}

async function queryTransactionPerformanceKpis(params: {
  table: QualifiedTableName;
  dateFrom: Date;
  dateTo: Date;
}): Promise<WalletTransactionPerformanceResponse["kpis"]> {
  const pool = await getPool();
  const request = pool.request();
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const result = await request.query(`
    SELECT
      COALESCE(SUM(COALESCE([value_of_deposits], 0)), 0) AS [depositValue],
      COALESCE(SUM(COALESCE([value_of_withdrawals], 0)), 0) AS [withdrawalValue],
      COALESCE(SUM(COALESCE([number_of_deposits], 0)), 0) AS [depositVolume],
      COALESCE(SUM(COALESCE([number_of_withdrawals], 0)), 0) AS [withdrawalVolume],
      COALESCE(SUM(COALESCE([total_value], 0)), 0) AS [totalTransactionValue],
      COALESCE(SUM(COALESCE([total_volume], 0)), 0) AS [totalTransactionVolume],
      COUNT(DISTINCT LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120))))) AS [activeCustomers]
    FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
    WHERE [date_id] >= @dateFrom
      AND [date_id] <= @dateTo
      AND [customer_id] IS NOT NULL
      AND LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) <> ''
  `);

  const row = (result.recordset[0] ?? {}) as NumericRecord;
  const activeCustomers = Math.trunc(toNumber(row.activeCustomers));
  const totalTransactionValue = toNumber(row.totalTransactionValue);
  const totalTransactionVolume = Math.trunc(toNumber(row.totalTransactionVolume));
  const depositValue = toNumber(row.depositValue);
  const withdrawalValue = toNumber(row.withdrawalValue);

  return {
    depositValue,
    withdrawalValue,
    netFlowValue: depositValue - withdrawalValue,
    depositVolume: Math.trunc(toNumber(row.depositVolume)),
    withdrawalVolume: Math.trunc(toNumber(row.withdrawalVolume)),
    totalTransactionValue,
    totalTransactionVolume,
    activeCustomers,
    valuePerActiveCustomer:
      activeCustomers === 0 ? 0 : totalTransactionValue / activeCustomers,
    volumePerActiveCustomer:
      activeCustomers === 0 ? 0 : totalTransactionVolume / activeCustomers,
  };
}

async function queryRevenuePerformanceTrend(params: {
  table: QualifiedTableName;
  dateFrom: Date;
  dateTo: Date;
  grain: "daily" | "monthly";
}): Promise<WalletRevenueTrendPoint[]> {
  const pool = await getPool();
  const request = pool.request();
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const periodExpression =
    params.grain === "daily"
      ? "CONVERT(VARCHAR(10), CAST([date_id] AS DATE), 23)"
      : "CONVERT(CHAR(7), CAST([date_id] AS DATE), 120)";

  const result = await request.query(`
    SELECT
      ${periodExpression} AS [period],
      COALESCE(SUM(COALESCE([total_commission], 0)), 0) AS [totalCommission],
      COALESCE(SUM(COALESCE([commission_on_deposits], 0)), 0) AS [depositCommission],
      COALESCE(SUM(COALESCE([commission_on_withdrawals], 0)), 0) AS [withdrawalCommission],
      COALESCE(SUM(COALESCE([total_value], 0)), 0) AS [totalTransactionValue],
      COALESCE(SUM(COALESCE([total_volume], 0)), 0) AS [totalTransactionVolume],
      COUNT(DISTINCT LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120))))) AS [activeCustomers]
    FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
    WHERE [date_id] >= @dateFrom
      AND [date_id] <= @dateTo
      AND [customer_id] IS NOT NULL
      AND LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) <> ''
    GROUP BY ${periodExpression}
    ORDER BY [period] ASC
  `);

  return (result.recordset as Array<Record<string, unknown>>).map((row) => {
    const totalCommission = toNumber(row.totalCommission);
    const totalTransactionValue = toNumber(row.totalTransactionValue);
    const totalTransactionVolume = Math.trunc(toNumber(row.totalTransactionVolume));
    const activeCustomers = Math.trunc(toNumber(row.activeCustomers));

    return {
      period: String(row.period),
      totalCommission,
      depositCommission: toNumber(row.depositCommission),
      withdrawalCommission: toNumber(row.withdrawalCommission),
      totalTransactionValue,
      totalTransactionVolume,
      activeCustomers,
      commissionPerTransaction:
        totalTransactionVolume === 0 ? 0 : totalCommission / totalTransactionVolume,
      commissionPerActiveCustomer:
        activeCustomers === 0 ? 0 : totalCommission / activeCustomers,
      commissionRate:
        totalTransactionValue === 0 ? 0 : (totalCommission / totalTransactionValue) * 100,
    };
  });
}

async function queryRevenuePerformanceKpis(params: {
  table: QualifiedTableName;
  dateFrom: Date;
  dateTo: Date;
}): Promise<WalletRevenuePerformanceResponse["kpis"]> {
  const pool = await getPool();
  const request = pool.request();
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const result = await request.query(`
    SELECT
      COALESCE(SUM(COALESCE([total_commission], 0)), 0) AS [totalCommission],
      COALESCE(SUM(COALESCE([commission_on_deposits], 0)), 0) AS [depositCommission],
      COALESCE(SUM(COALESCE([commission_on_withdrawals], 0)), 0) AS [withdrawalCommission],
      COALESCE(SUM(COALESCE([total_value], 0)), 0) AS [totalTransactionValue],
      COALESCE(SUM(COALESCE([total_volume], 0)), 0) AS [totalTransactionVolume],
      COUNT(DISTINCT LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120))))) AS [activeCustomers]
    FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
    WHERE [date_id] >= @dateFrom
      AND [date_id] <= @dateTo
      AND [customer_id] IS NOT NULL
      AND LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) <> ''
  `);

  const row = (result.recordset[0] ?? {}) as NumericRecord;
  const totalCommission = toNumber(row.totalCommission);
  const totalTransactionValue = toNumber(row.totalTransactionValue);
  const totalTransactionVolume = Math.trunc(toNumber(row.totalTransactionVolume));
  const activeCustomers = Math.trunc(toNumber(row.activeCustomers));

  return {
    totalCommission,
    depositCommission: toNumber(row.depositCommission),
    withdrawalCommission: toNumber(row.withdrawalCommission),
    totalTransactionValue,
    totalTransactionVolume,
    activeCustomers,
    commissionPerTransaction:
      totalTransactionVolume === 0 ? 0 : totalCommission / totalTransactionVolume,
    commissionPerActiveCustomer:
      activeCustomers === 0 ? 0 : totalCommission / activeCustomers,
    commissionRate:
      totalTransactionValue === 0 ? 0 : (totalCommission / totalTransactionValue) * 100,
  };
}

async function queryLiquiditySnapshot(params: {
  table: QualifiedTableName;
  asOfDate: Date;
}): Promise<WalletLiquidityResponse["kpis"]> {
  const pool = await getPool();
  const request = pool.request();
  request.input("asOfDate", sql.Date, params.asOfDate);
  request.input("lowBalanceThreshold", sql.Decimal(18, 2), LOW_BALANCE_THRESHOLD);

  const result = await request.query(`
    DECLARE @snapshotDate DATE;

    SELECT TOP 1 @snapshotDate = CAST([balance_date] AS DATE)
    FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
    WHERE [balance_date] <= @asOfDate
    ORDER BY [balance_date] DESC;

    WITH snapshot_rows AS (
      SELECT
        LTRIM(RTRIM(CAST([account_number] AS VARCHAR(120)))) AS accountNumber,
        COALESCE([available_balance], 0) AS availableBalance
      FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
      WHERE [balance_date] >= @snapshotDate
        AND [balance_date] < DATEADD(DAY, 1, @snapshotDate)
        AND [account_number] IS NOT NULL
        AND LTRIM(RTRIM(CAST([account_number] AS VARCHAR(120)))) <> ''
    ),
    deduped AS (
      SELECT accountNumber, MAX(availableBalance) AS availableBalance
      FROM snapshot_rows
      GROUP BY accountNumber
    ),
    with_median AS (
      SELECT
        accountNumber,
        availableBalance,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY availableBalance) OVER () AS medianBalance
      FROM deduped
    ),
    ranked AS (
      SELECT
        accountNumber,
        availableBalance,
        ROW_NUMBER() OVER (ORDER BY availableBalance DESC) AS balanceRank
      FROM deduped
    )
    SELECT
      COALESCE(SUM(w.availableBalance), 0) AS latestTotalEFloat,
      @snapshotDate AS latestEFloatDate,
      COUNT_BIG(*) AS accountCount,
      COALESCE(SUM(CASE WHEN w.availableBalance < @lowBalanceThreshold THEN 1 ELSE 0 END), 0) AS lowBalanceAccounts,
      COALESCE(SUM(CASE WHEN w.availableBalance <= 0 THEN 1 ELSE 0 END), 0) AS zeroOrNegativeAccounts,
      COALESCE(AVG(w.availableBalance), 0) AS averageBalance,
      COALESCE(MAX(w.medianBalance), 0) AS medianBalance,
      COALESCE((
        SELECT SUM(r.availableBalance)
        FROM ranked r
        WHERE r.balanceRank <= CEILING((SELECT COUNT_BIG(*) FROM deduped) * 0.1)
      ), 0) AS top10BalanceTotal
    FROM with_median w
  `);

  const row = (result.recordset[0] ?? {}) as NumericRecord;
  const latestTotalEFloat = toNumber(row.latestTotalEFloat);
  const top10BalanceTotal = toNumber(row.top10BalanceTotal);
  const snapshotDate = row.latestEFloatDate;

  return {
    latestTotalEFloat,
    latestEFloatDate: snapshotDate instanceof Date ? formatDate(snapshotDate) : null,
    accountCount: Math.trunc(toNumber(row.accountCount)),
    lowBalanceAccounts: Math.trunc(toNumber(row.lowBalanceAccounts)),
    zeroOrNegativeAccounts: Math.trunc(toNumber(row.zeroOrNegativeAccounts)),
    averageBalance: toNumber(row.averageBalance),
    medianBalance: toNumber(row.medianBalance),
    top10BalanceConcentration:
      latestTotalEFloat === 0 ? 0 : (top10BalanceTotal / latestTotalEFloat) * 100,
  };
}

async function queryLiquidityTrend(params: {
  table: QualifiedTableName;
  dateFrom: Date;
  dateTo: Date;
}): Promise<WalletLiquidityTrendPoint[]> {
  const pool = await getPool();
  const request = pool.request();
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);
  request.input("lowBalanceThreshold", sql.Decimal(18, 2), LOW_BALANCE_THRESHOLD);

  const result = await request.query(`
    WITH daily_account_balances AS (
      SELECT
        CONVERT(VARCHAR(10), CAST([balance_date] AS DATE), 23) AS period,
        LTRIM(RTRIM(CAST([account_number] AS VARCHAR(120)))) AS accountNumber,
        MAX(COALESCE([available_balance], 0)) AS availableBalance
      FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
      WHERE [balance_date] >= @dateFrom
        AND [balance_date] <= @dateTo
        AND [account_number] IS NOT NULL
        AND LTRIM(RTRIM(CAST([account_number] AS VARCHAR(120)))) <> ''
      GROUP BY
        CONVERT(VARCHAR(10), CAST([balance_date] AS DATE), 23),
        LTRIM(RTRIM(CAST([account_number] AS VARCHAR(120))))
    )
    SELECT
      period,
      COALESCE(SUM(availableBalance), 0) AS totalEFloat,
      COALESCE(AVG(availableBalance), 0) AS averageBalance,
      COUNT_BIG(*) AS accountCount,
      COALESCE(SUM(CASE WHEN availableBalance < @lowBalanceThreshold THEN 1 ELSE 0 END), 0) AS lowBalanceAccounts,
      COALESCE(SUM(CASE WHEN availableBalance <= 0 THEN 1 ELSE 0 END), 0) AS zeroOrNegativeAccounts
    FROM daily_account_balances
    GROUP BY period
    ORDER BY period ASC
  `);

  return (result.recordset as Array<Record<string, unknown>>).map((row) => ({
    period: String(row.period),
    totalEFloat: toNumber(row.totalEFloat),
    averageBalance: toNumber(row.averageBalance),
    accountCount: Math.trunc(toNumber(row.accountCount)),
    lowBalanceAccounts: Math.trunc(toNumber(row.lowBalanceAccounts)),
    zeroOrNegativeAccounts: Math.trunc(toNumber(row.zeroOrNegativeAccounts)),
  }));
}

async function queryLiquidityProductBreakdown(params: {
  table: QualifiedTableName;
  asOfDate: Date;
}): Promise<WalletLiquidityProductBreakdownItem[]> {
  const pool = await getPool();
  const request = pool.request();
  request.input("asOfDate", sql.Date, params.asOfDate);
  request.input("lowBalanceThreshold", sql.Decimal(18, 2), LOW_BALANCE_THRESHOLD);

  const result = await request.query(`
    DECLARE @snapshotDate DATE;

    SELECT TOP 1 @snapshotDate = CAST([balance_date] AS DATE)
    FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
    WHERE [balance_date] <= @asOfDate
    ORDER BY [balance_date] DESC;

    WITH snapshot_rows AS (
      SELECT
        COALESCE(NULLIF(LTRIM(RTRIM(CAST([account_product] AS VARCHAR(160)))), ''), 'Unclassified') AS accountProduct,
        LTRIM(RTRIM(CAST([account_number] AS VARCHAR(120)))) AS accountNumber,
        COALESCE([available_balance], 0) AS availableBalance
      FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
      WHERE [balance_date] >= @snapshotDate
        AND [balance_date] < DATEADD(DAY, 1, @snapshotDate)
        AND [account_number] IS NOT NULL
        AND LTRIM(RTRIM(CAST([account_number] AS VARCHAR(120)))) <> ''
    ),
    deduped AS (
      SELECT accountProduct, accountNumber, MAX(availableBalance) AS availableBalance
      FROM snapshot_rows
      GROUP BY accountProduct, accountNumber
    )
    SELECT TOP 12
      accountProduct,
      COUNT_BIG(*) AS accountCount,
      COALESCE(SUM(availableBalance), 0) AS totalEFloat,
      COALESCE(AVG(availableBalance), 0) AS averageBalance,
      COALESCE(SUM(CASE WHEN availableBalance < @lowBalanceThreshold THEN 1 ELSE 0 END), 0) AS lowBalanceAccounts
    FROM deduped
    GROUP BY accountProduct
    ORDER BY totalEFloat DESC
  `);

  return (result.recordset as Array<Record<string, unknown>>).map((row) => ({
    accountProduct: String(row.accountProduct),
    accountCount: Math.trunc(toNumber(row.accountCount)),
    totalEFloat: toNumber(row.totalEFloat),
    averageBalance: toNumber(row.averageBalance),
    lowBalanceAccounts: Math.trunc(toNumber(row.lowBalanceAccounts)),
  }));
}

function mapCustomer360Summary(
  row: Record<string, unknown>,
  asOfDate: Date,
): WalletCustomer360Summary {
  const firstSeenDate = row.firstSeenDate instanceof Date ? row.firstSeenDate : new Date(String(row.firstSeenDate));
  const lastSeenDate = row.lastSeenDate instanceof Date ? row.lastSeenDate : new Date(String(row.lastSeenDate));
  const daysSinceLastActivity = daysBetween(lastSeenDate, asOfDate);

  return {
    customerId: String(row.customerId),
    fullName: row.fullName === null || row.fullName === undefined ? null : String(row.fullName),
    mobileNumber: row.mobileNumber === null || row.mobileNumber === undefined ? null : String(row.mobileNumber),
    firstSeenDate: formatDate(firstSeenDate),
    lastSeenDate: formatDate(lastSeenDate),
    daysSinceLastActivity,
    dormancyStatus: getDormancyStatus(daysSinceLastActivity),
    lifetimeTransactionValue: toNumber(row.lifetimeTransactionValue),
    lifetimeTransactionVolume: Math.trunc(toNumber(row.lifetimeTransactionVolume)),
    lifetimeCommission: toNumber(row.lifetimeCommission),
    last30DayTransactionValue: toNumber(row.last30DayTransactionValue),
    last60DayTransactionValue: toNumber(row.last60DayTransactionValue),
  };
}

function buildCustomer360Where(input: {
  search?: string;
  status?: "all" | "active_a30" | "dormant_90";
  asOfDate: Date;
}): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`[firstSeenDate] <= ${input.asOfDate}`];
  const search = input.search?.trim();

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(Prisma.sql`(
      [customerId] LIKE ${pattern}
      OR [fullName] LIKE ${pattern}
      OR [mobileNumber] LIKE ${pattern}
    )`);
  }

  if (input.status === "active_a30") {
    conditions.push(Prisma.sql`[lastSeenDate] >= ${addDays(input.asOfDate, -29)}`);
  } else if (input.status === "dormant_90") {
    conditions.push(Prisma.sql`[lastSeenDate] < ${addDays(input.asOfDate, -90)}`);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

function addInsightAlert(
  alerts: WalletInsightAlertItem[],
  alert: WalletInsightAlertItem,
): void {
  alerts.push(alert);
}

function summarizeInsightAlerts(
  alerts: WalletInsightAlertItem[],
): WalletInsightsAlertsResponse["summary"] {
  return {
    criticalCount: alerts.filter((alert) => alert.severity === "critical").length,
    warningCount: alerts.filter((alert) => alert.severity === "warning").length,
    positiveCount: alerts.filter((alert) => alert.severity === "positive").length,
    infoCount: alerts.filter((alert) => alert.severity === "info").length,
    totalAlerts: alerts.length,
  };
}

async function getCustomerSnapshotRefreshedAt(): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ snapshotRefreshedAt: Date | null }>>`
    SELECT MAX([refreshedAt]) AS [snapshotRefreshedAt]
    FROM [WalletCustomerActivitySnapshot]
  `;
  const snapshotRefreshedAt = rows[0]?.snapshotRefreshedAt;
  return snapshotRefreshedAt instanceof Date ? snapshotRefreshedAt.toISOString() : null;
}

async function queryCustomer360Snapshot(customerId: string): Promise<Record<string, unknown> | null> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT TOP 1
      [customerId],
      [fullName],
      [mobileNumber],
      [firstSeenDate],
      [lastSeenDate],
      [lifetimeTransactionValue],
      [lifetimeTransactionVolume],
      [lifetimeCommission],
      [last30DayTransactionValue],
      [last60DayTransactionValue]
    FROM [WalletCustomerActivitySnapshot]
    WHERE [customerId] = ${customerId}
  `;

  return rows[0] ?? null;
}

async function queryCustomer360SourceDetail(params: {
  table: QualifiedTableName;
  customerId: string;
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
}): Promise<{
  kpis: WalletCustomer360DetailResponse["kpis"];
  dailyTrend: WalletCustomer360TrendPoint[];
}> {
  const pool = await getPool();
  const request = pool.request();
  request.input("customerId", sql.VarChar(120), params.customerId);
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);
  request.input("last90Date", sql.Date, addDays(params.asOfDate, -89));
  request.input("asOfDate", sql.Date, params.asOfDate);

  const result = await request.query(`
    SELECT
      COALESCE(SUM(CASE WHEN [date_id] >= @dateFrom AND [date_id] <= @dateTo THEN COALESCE([total_value], 0) ELSE 0 END), 0) AS [selectedPeriodTransactionValue],
      COALESCE(SUM(CASE WHEN [date_id] >= @dateFrom AND [date_id] <= @dateTo THEN COALESCE([total_volume], 0) ELSE 0 END), 0) AS [selectedPeriodTransactionVolume],
      COALESCE(SUM(CASE WHEN [date_id] >= @dateFrom AND [date_id] <= @dateTo THEN COALESCE([total_commission], 0) ELSE 0 END), 0) AS [selectedPeriodCommission],
      COALESCE(SUM(CASE WHEN [date_id] >= @last90Date AND [date_id] <= @asOfDate THEN COALESCE([total_value], 0) ELSE 0 END), 0) AS [last90DayTransactionValue],
      COALESCE(SUM(CASE WHEN [date_id] >= @last90Date AND [date_id] <= @asOfDate THEN COALESCE([total_volume], 0) ELSE 0 END), 0) AS [last90DayTransactionVolume]
    FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
    WHERE LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) = @customerId;

    SELECT
      CONVERT(VARCHAR(10), CAST([date_id] AS DATE), 23) AS [period],
      COALESCE(SUM(COALESCE([total_value], 0)), 0) AS [transactionValue],
      COALESCE(SUM(COALESCE([total_volume], 0)), 0) AS [transactionVolume],
      COALESCE(SUM(COALESCE([total_commission], 0)), 0) AS [commission],
      COALESCE(SUM(COALESCE([value_of_deposits], 0)), 0) AS [depositValue],
      COALESCE(SUM(COALESCE([value_of_withdrawals], 0)), 0) AS [withdrawalValue]
    FROM [${params.table.schema}].[${params.table.table}] WITH (NOLOCK)
    WHERE [date_id] >= @dateFrom
      AND [date_id] <= @dateTo
      AND LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) = @customerId
    GROUP BY CONVERT(VARCHAR(10), CAST([date_id] AS DATE), 23)
    ORDER BY [period] ASC;
  `);

  const recordsets = result.recordsets as unknown as Array<Array<Record<string, unknown>>>;
  const kpiRow = (recordsets[0]?.[0] ?? {}) as NumericRecord;
  const selectedPeriodTransactionValue = toNumber(kpiRow.selectedPeriodTransactionValue);
  const selectedPeriodTransactionVolume = Math.trunc(toNumber(kpiRow.selectedPeriodTransactionVolume));

  return {
    kpis: {
      selectedPeriodTransactionValue,
      selectedPeriodTransactionVolume,
      selectedPeriodCommission: toNumber(kpiRow.selectedPeriodCommission),
      last90DayTransactionValue: toNumber(kpiRow.last90DayTransactionValue),
      last90DayTransactionVolume: Math.trunc(toNumber(kpiRow.last90DayTransactionVolume)),
      averageTransactionValue:
        selectedPeriodTransactionVolume === 0
          ? 0
          : selectedPeriodTransactionValue / selectedPeriodTransactionVolume,
    },
    dailyTrend: (recordsets[1] ?? []).map((row) => ({
      period: String(row.period),
      transactionValue: toNumber(row.transactionValue),
      transactionVolume: Math.trunc(toNumber(row.transactionVolume)),
      commission: toNumber(row.commission),
      depositValue: toNumber(row.depositValue),
      withdrawalValue: toNumber(row.withdrawalValue),
    })),
  };
}

async function computeKpis(input: {
  summaryTable: QualifiedTableName;
  balanceTable: QualifiedTableName;
  balanceCurrentTable: QualifiedTableName;
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
}): Promise<WalletKpis> {
  const [transactionKpis, customerKpis, eFloatKpis] = await Promise.all([
    queryTransactionKpis({
      table: input.summaryTable,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
    }),
    queryCustomerKpis({
      table: input.summaryTable,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      asOfDate: input.asOfDate,
    }),
    queryEFloatWithFallback({
      currentTable: input.balanceCurrentTable,
      historicalTable: input.balanceTable,
      asOfDate: input.asOfDate,
    }),
  ]);

  return {
    ...transactionKpis,
    ...customerKpis,
    ...eFloatKpis,
  };
}

export async function getWalletOverview(
  input: WalletOverviewInput,
): Promise<WalletOverviewResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const summaryTable = parseQualifiedTableName(env.SOURCE_SQL_AGENT_SUMMARY_TABLE);
  const balanceTable = parseQualifiedTableName(env.SOURCE_SQL_AGENT_BALANCE_TABLE);
  const balanceCurrentTable = parseQualifiedTableName(env.SOURCE_SQL_AGENT_BALANCE_CURRENT_TABLE);

  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);
  const asOfDate = normalizeDateOnly(input.asOfDate);
  const daySpan = Math.max(
    1,
    Math.floor((dateTo.getTime() - dateFrom.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );

  const previousDateTo = addDays(dateFrom, -1);
  const previousDateFrom = addDays(previousDateTo, -(daySpan - 1));

  const kpis = await computeKpis({
    summaryTable,
    balanceTable,
    balanceCurrentTable,
    dateFrom,
    dateTo,
    asOfDate,
  });

  let comparison: WalletOverviewResponse["comparison"] = null;
  if (input.compare) {
    const previousKpis = await computeKpis({
      summaryTable,
      balanceTable,
      balanceCurrentTable,
      dateFrom: previousDateFrom,
      dateTo: previousDateTo,
      asOfDate: previousDateTo,
    });

    comparison = {
      previousPeriodDateFrom: formatDate(previousDateFrom),
      previousPeriodDateTo: formatDate(previousDateTo),
      kpis: {
        totalTransactionValue: buildComparisonKpi(
          kpis.totalTransactionValue,
          previousKpis.totalTransactionValue,
        ),
        totalTransactionVolume: buildComparisonKpi(
          kpis.totalTransactionVolume,
          previousKpis.totalTransactionVolume,
        ),
        totalCommission: buildComparisonKpi(
          kpis.totalCommission,
          previousKpis.totalCommission,
        ),
        activeCustomersA30: buildComparisonKpi(
          kpis.activeCustomersA30,
          previousKpis.activeCustomersA30,
        ),
        activeCustomersA60: buildComparisonKpi(
          kpis.activeCustomersA60,
          previousKpis.activeCustomersA60,
        ),
        newCustomers: buildComparisonKpi(
          kpis.newCustomers,
          previousKpis.newCustomers,
        ),
        dormantCustomers90Plus:
          kpis.dormantCustomers90Plus === null ||
          previousKpis.dormantCustomers90Plus === null
            ? null
            : buildComparisonKpi(
                kpis.dormantCustomers90Plus,
                previousKpis.dormantCustomers90Plus,
              ),
        latestTotalEFloat: buildComparisonKpi(
          kpis.latestTotalEFloat,
          previousKpis.latestTotalEFloat,
        ),
      },
    };
  }

  return {
    period: {
      dateFrom: formatDate(dateFrom),
      dateTo: formatDate(dateTo),
      asOfDate: formatDate(asOfDate),
    },
    kpis,
    comparison,
    metadata: {
      currency: "USD",
      dataFreshnessTimestamp: new Date().toISOString(),
      sourceSummaryTable: env.SOURCE_SQL_AGENT_SUMMARY_TABLE,
      sourceBalanceTable: env.SOURCE_SQL_AGENT_BALANCE_TABLE,
      sourceBalanceCurrentTable: env.SOURCE_SQL_AGENT_BALANCE_CURRENT_TABLE,
    },
  };
}

export async function getWalletCustomerActivityGrowth(
  input: WalletCustomerActivityGrowthInput,
): Promise<WalletCustomerActivityGrowthResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const summaryTable = parseQualifiedTableName(env.SOURCE_SQL_AGENT_SUMMARY_TABLE);
  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);

  const [
    dailyActiveRows,
    monthlyActiveRows,
    dailyNewCustomers,
    monthlyNewCustomers,
    frequencyBuckets,
    snapshotRefreshedAt,
  ] = await Promise.all([
    queryActivityTrendFromSource({
      table: summaryTable,
      dateFrom,
      dateTo,
      grain: "daily",
    }),
    queryActivityTrendFromSource({
      table: summaryTable,
      dateFrom,
      dateTo,
      grain: "monthly",
    }),
    queryNewCustomerTrendFromSnapshot({
      dateFrom,
      dateTo,
      grain: "daily",
    }),
    queryNewCustomerTrendFromSnapshot({
      dateFrom,
      dateTo,
      grain: "monthly",
    }),
    queryFrequencyBucketsFromSource({
      table: summaryTable,
      dateFrom,
      dateTo,
    }),
    getSnapshotRefreshedAt(),
  ]);

  const dailyTrend = mergeActivityTrend(dailyActiveRows, dailyNewCustomers);
  const monthlyTrend = mergeActivityTrend(monthlyActiveRows, monthlyNewCustomers);
  const totalActiveCustomers = frequencyBuckets.reduce(
    (sum, bucket) => sum + bucket.customers,
    0,
  );
  const newCustomers = dailyTrend.reduce((sum, point) => sum + point.newCustomers, 0);
  const transactionVolume = dailyTrend.reduce(
    (sum, point) => sum + point.transactionVolume,
    0,
  );

  return {
    period: {
      dateFrom: formatDate(dateFrom),
      dateTo: formatDate(dateTo),
    },
    kpis: {
      activeCustomers: totalActiveCustomers,
      newCustomers,
      returningCustomers: Math.max(0, totalActiveCustomers - newCustomers),
      transactionVolume,
      averageTransactionsPerActiveCustomer:
        totalActiveCustomers === 0 ? 0 : transactionVolume / totalActiveCustomers,
    },
    dailyTrend,
    monthlyTrend,
    frequencyBuckets,
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
      snapshotRefreshedAt,
      sourceSummaryTable: env.SOURCE_SQL_AGENT_SUMMARY_TABLE,
    },
  };
}

export async function getWalletRetentionDormancy(
  input: WalletRetentionDormancyInput,
): Promise<WalletRetentionDormancyResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);
  const asOfDate = normalizeDateOnly(input.asOfDate);
  const [retention, snapshotRefreshedAt] = await Promise.all([
    queryRetentionDormancyFromSnapshot({ dateFrom, dateTo, asOfDate }),
    getSnapshotRefreshedAt(),
  ]);
  const reactivatedCustomers = retention.reactivationTrend.reduce(
    (sum, point) => sum + point.reactivatedCustomers,
    0,
  );

  return {
    period: {
      dateFrom: formatDate(dateFrom),
      dateTo: formatDate(dateTo),
      asOfDate: formatDate(asOfDate),
    },
    kpis: {
      activeCustomersA30: retention.activeCustomersA30,
      dormantCustomers90Plus: retention.dormantCustomers90Plus,
      dormancyRate:
        retention.totalCustomers === 0
          ? 0
          : (retention.dormantCustomers90Plus / retention.totalCustomers) * 100,
      reactivatedCustomers,
    },
    inactivityBuckets: retention.inactivityBuckets,
    reactivationTrend: retention.reactivationTrend,
    cohorts: retention.cohorts,
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
      snapshotRefreshedAt,
    },
  };
}

export async function getWalletTransactionPerformance(
  input: WalletTransactionPerformanceInput,
): Promise<WalletTransactionPerformanceResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const summaryTable = parseQualifiedTableName(env.SOURCE_SQL_AGENT_SUMMARY_TABLE);
  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);
  const [kpis, dailyTrend, monthlyTrend] = await Promise.all([
    queryTransactionPerformanceKpis({
      table: summaryTable,
      dateFrom,
      dateTo,
    }),
    queryTransactionPerformanceTrend({
      table: summaryTable,
      dateFrom,
      dateTo,
      grain: "daily",
    }),
    queryTransactionPerformanceTrend({
      table: summaryTable,
      dateFrom,
      dateTo,
      grain: "monthly",
    }),
  ]);

  return {
    period: {
      dateFrom: formatDate(dateFrom),
      dateTo: formatDate(dateTo),
    },
    kpis,
    dailyTrend,
    monthlyTrend,
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
      sourceSummaryTable: env.SOURCE_SQL_AGENT_SUMMARY_TABLE,
    },
  };
}

export async function getWalletRevenuePerformance(
  input: WalletRevenuePerformanceInput,
): Promise<WalletRevenuePerformanceResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const summaryTable = parseQualifiedTableName(env.SOURCE_SQL_AGENT_SUMMARY_TABLE);
  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);
  const [kpis, dailyTrend, monthlyTrend] = await Promise.all([
    queryRevenuePerformanceKpis({
      table: summaryTable,
      dateFrom,
      dateTo,
    }),
    queryRevenuePerformanceTrend({
      table: summaryTable,
      dateFrom,
      dateTo,
      grain: "daily",
    }),
    queryRevenuePerformanceTrend({
      table: summaryTable,
      dateFrom,
      dateTo,
      grain: "monthly",
    }),
  ]);

  return {
    period: {
      dateFrom: formatDate(dateFrom),
      dateTo: formatDate(dateTo),
    },
    kpis,
    dailyTrend,
    monthlyTrend,
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
      sourceSummaryTable: env.SOURCE_SQL_AGENT_SUMMARY_TABLE,
    },
  };
}

export async function getWalletLiquidity(
  input: WalletLiquidityInput,
): Promise<WalletLiquidityResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const balanceCurrentTable = parseQualifiedTableName(env.SOURCE_SQL_AGENT_BALANCE_CURRENT_TABLE);
  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);
  const asOfDate = normalizeDateOnly(input.asOfDate);
  const [kpis, dailyTrend, productBreakdown] = await Promise.all([
    queryLiquiditySnapshot({
      table: balanceCurrentTable,
      asOfDate,
    }),
    queryLiquidityTrend({
      table: balanceCurrentTable,
      dateFrom,
      dateTo,
    }),
    queryLiquidityProductBreakdown({
      table: balanceCurrentTable,
      asOfDate,
    }),
  ]);

  return {
    period: {
      dateFrom: formatDate(dateFrom),
      dateTo: formatDate(dateTo),
      asOfDate: formatDate(asOfDate),
    },
    kpis,
    dailyTrend,
    productBreakdown,
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
      sourceBalanceCurrentTable: env.SOURCE_SQL_AGENT_BALANCE_CURRENT_TABLE,
      lowBalanceThreshold: LOW_BALANCE_THRESHOLD,
    },
  };
}

export async function listWalletCustomer360(
  input: WalletCustomer360ListInput,
): Promise<WalletCustomer360ListResponse> {
  const asOfDate = normalizeDateOnly(input.asOfDate);
  const page = Math.max(1, Math.trunc(input.page));
  const pageSize = Math.min(100, Math.max(5, Math.trunc(input.pageSize)));
  const offset = (page - 1) * pageSize;
  const whereClause = buildCustomer360Where({
    search: input.search,
    status: input.status ?? "all",
    asOfDate,
  });

  const [countRows, itemRows, snapshotRefreshedAt] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint | number }>>`
      SELECT COUNT_BIG(*) AS [total]
      FROM [WalletCustomerActivitySnapshot]
      ${whereClause}
    `,
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT
        [customerId],
        [fullName],
        [mobileNumber],
        [firstSeenDate],
        [lastSeenDate],
        [lifetimeTransactionValue],
        [lifetimeTransactionVolume],
        [lifetimeCommission],
        [last30DayTransactionValue],
        [last60DayTransactionValue]
      FROM [WalletCustomerActivitySnapshot]
      ${whereClause}
      ORDER BY [lifetimeTransactionValue] DESC, [lastSeenDate] DESC
      OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
    `,
    getCustomerSnapshotRefreshedAt(),
  ]);

  return {
    items: itemRows.map((row) => mapCustomer360Summary(row, asOfDate)),
    page,
    pageSize,
    total: Math.trunc(toNumber(countRows[0]?.total)),
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
      snapshotRefreshedAt,
    },
  };
}

export async function getWalletCustomer360Detail(
  input: WalletCustomer360DetailInput,
): Promise<WalletCustomer360DetailResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const customerId = input.customerId.trim();
  if (!customerId) {
    throw new WalletServiceError("customerId is required", 400);
  }

  const snapshot = await queryCustomer360Snapshot(customerId);
  if (!snapshot) {
    throw new WalletServiceError("Customer not found", 404);
  }

  const summaryTable = parseQualifiedTableName(env.SOURCE_SQL_AGENT_SUMMARY_TABLE);
  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);
  const asOfDate = normalizeDateOnly(input.asOfDate);
  const [sourceDetail, snapshotRefreshedAt] = await Promise.all([
    queryCustomer360SourceDetail({
      table: summaryTable,
      customerId,
      dateFrom,
      dateTo,
      asOfDate,
    }),
    getCustomerSnapshotRefreshedAt(),
  ]);

  return {
    customer: mapCustomer360Summary(snapshot, asOfDate),
    kpis: sourceDetail.kpis,
    dailyTrend: sourceDetail.dailyTrend,
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
      sourceSummaryTable: env.SOURCE_SQL_AGENT_SUMMARY_TABLE,
      snapshotRefreshedAt,
    },
  };
}

export async function getWalletInsightsAlerts(
  input: WalletInsightsAlertsInput,
): Promise<WalletInsightsAlertsResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);
  const asOfDate = normalizeDateOnly(input.asOfDate);
  const [overview, transactionPerformance, revenuePerformance, liquidity] = await Promise.all([
    getWalletOverview({
      dateFrom,
      dateTo,
      asOfDate,
      compare: true,
    }),
    getWalletTransactionPerformance({
      dateFrom,
      dateTo,
    }),
    getWalletRevenuePerformance({
      dateFrom,
      dateTo,
    }),
    getWalletLiquidity({
      dateFrom,
      dateTo,
      asOfDate,
    }),
  ]);

  const alerts: WalletInsightAlertItem[] = [];
  const transactionValueChange =
    overview.comparison?.kpis.totalTransactionValue.percentChange ?? null;
  const activeA30Change = overview.comparison?.kpis.activeCustomersA30.percentChange ?? null;
  const dormantChange = overview.comparison?.kpis.dormantCustomers90Plus?.percentChange ?? null;
  const commissionRate = revenuePerformance.kpis.commissionRate;
  const netFlowValue = transactionPerformance.kpis.netFlowValue;
  const lowBalanceShare =
    liquidity.kpis.accountCount === 0
      ? 0
      : (liquidity.kpis.lowBalanceAccounts / liquidity.kpis.accountCount) * 100;

  if (transactionValueChange !== null && transactionValueChange <= -10) {
    addInsightAlert(alerts, {
      id: "growth-transaction-value-down",
      severity: transactionValueChange <= -20 ? "critical" : "warning",
      category: "growth",
      title: "Transaction value is down",
      metricLabel: "Transaction value change",
      metricValue: transactionValueChange,
      thresholdLabel: "Below -10%",
      message: "Wallet transaction value declined against the previous comparable period.",
      suggestedAction: "Review the largest-value customers and compare deposits versus withdrawals for the same period.",
    });
  } else if (transactionValueChange !== null && transactionValueChange >= 10) {
    addInsightAlert(alerts, {
      id: "growth-transaction-value-up",
      severity: "positive",
      category: "growth",
      title: "Transaction value is growing",
      metricLabel: "Transaction value change",
      metricValue: transactionValueChange,
      thresholdLabel: "Above +10%",
      message: "Wallet transaction value improved against the previous comparable period.",
      suggestedAction: "Check whether customer activity and revenue quality moved up with value growth.",
    });
  }

  if (activeA30Change !== null && activeA30Change <= -8) {
    addInsightAlert(alerts, {
      id: "activity-a30-down",
      severity: activeA30Change <= -15 ? "critical" : "warning",
      category: "activity",
      title: "Active customers A30 are down",
      metricLabel: "A30 change",
      metricValue: activeA30Change,
      thresholdLabel: "Below -8%",
      message: "Recent active customer usage weakened compared with the previous period.",
      suggestedAction: "Use Customer 360 to identify high-value customers whose last activity moved beyond 30 days.",
    });
  }

  if (dormantChange !== null && dormantChange >= 5) {
    addInsightAlert(alerts, {
      id: "dormancy-90-up",
      severity: dormantChange >= 15 ? "critical" : "warning",
      category: "dormancy",
      title: "Dormant customers are rising",
      metricLabel: "Dormant 90+ change",
      metricValue: dormantChange,
      thresholdLabel: "Above +5%",
      message: "The dormant 90+ customer base increased against the previous comparable period.",
      suggestedAction: "Prioritize reactivation for customers with high lifetime value and recent last-60 activity.",
    });
  }

  if (commissionRate < 0.5) {
    addInsightAlert(alerts, {
      id: "revenue-commission-rate-low",
      severity: commissionRate < 0.35 ? "critical" : "warning",
      category: "revenue",
      title: "Commission rate is low",
      metricLabel: "Commission rate",
      metricValue: commissionRate,
      thresholdLabel: "Below 0.5%",
      message: "Commission is not scaling strongly relative to transaction value.",
      suggestedAction: "Review product mix and transaction types driving high value but low commission contribution.",
    });
  }

  if (netFlowValue < 0) {
    addInsightAlert(alerts, {
      id: "cash-flow-negative-net-flow",
      severity: netFlowValue <= -100_000 ? "critical" : "warning",
      category: "cash_flow",
      title: "Net flow is negative",
      metricLabel: "Net flow",
      metricValue: netFlowValue,
      thresholdLabel: "Below 0",
      message: "Withdrawal value is higher than deposit value in the selected period.",
      suggestedAction: "Monitor liquidity pressure and compare this period against low-balance account movement.",
    });
  }

  if (lowBalanceShare >= 60) {
    addInsightAlert(alerts, {
      id: "liquidity-low-balance-share-high",
      severity: lowBalanceShare >= 80 ? "critical" : "warning",
      category: "liquidity",
      title: "Low-balance account share is high",
      metricLabel: "Low-balance share",
      metricValue: lowBalanceShare,
      thresholdLabel: "Above 60%",
      message: "A large share of wallet accounts are below the configured low-balance threshold.",
      suggestedAction: "Use Wallet Liquidity to identify affected products and funding concentration risk.",
    });
  }

  if (liquidity.kpis.top10BalanceConcentration >= 80) {
    addInsightAlert(alerts, {
      id: "liquidity-concentration-high",
      severity: liquidity.kpis.top10BalanceConcentration >= 90 ? "critical" : "warning",
      category: "liquidity",
      title: "Balance concentration is high",
      metricLabel: "Top 10% concentration",
      metricValue: liquidity.kpis.top10BalanceConcentration,
      thresholdLabel: "Above 80%",
      message: "Most e-float is concentrated in a small share of accounts.",
      suggestedAction: "Review product and account concentration before funding decisions are made.",
    });
  }

  if (alerts.length === 0) {
    addInsightAlert(alerts, {
      id: "wallet-no-material-alerts",
      severity: "info",
      category: "growth",
      title: "No material wallet alerts",
      metricLabel: "Alert count",
      metricValue: 0,
      thresholdLabel: "No triggered thresholds",
      message: "No configured wallet insight threshold was triggered for this period.",
      suggestedAction: "Continue monitoring revenue quality, customer activity, and liquidity movement.",
    });
  }

  alerts.sort((left, right) => {
    const severityRank: Record<WalletInsightAlertSeverity, number> = {
      critical: 0,
      warning: 1,
      positive: 2,
      info: 3,
    };
    return severityRank[left.severity] - severityRank[right.severity];
  });

  return {
    period: {
      dateFrom: formatDate(dateFrom),
      dateTo: formatDate(dateTo),
      asOfDate: formatDate(asOfDate),
    },
    summary: summarizeInsightAlerts(alerts),
    alerts,
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
      sourceSummaryTable: env.SOURCE_SQL_AGENT_SUMMARY_TABLE,
      sourceBalanceCurrentTable: env.SOURCE_SQL_AGENT_BALANCE_CURRENT_TABLE,
    },
  };
}
