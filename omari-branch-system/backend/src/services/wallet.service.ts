import sql from "mssql";

import { env } from "../config/env";

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

type Currency = "USD" | "ZWL";

export type WalletOverviewInput = {
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
  compare: boolean;
  currency: Currency;
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
    currency: string;
    dataFreshnessTimestamp: string;
    sourceSummaryTable: string;
    sourceBalanceTable: string;
    sourceBalanceCurrentTable: string;
  };
};

export type WalletCustomerActivityGrowthInput = {
  dateFrom: Date;
  dateTo: Date;
  currency: Currency;
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
    sourceSummaryTable: string;
  };
};

export type WalletRetentionDormancyInput = {
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
  currency: Currency;
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
  };
};

export type WalletTransactionPerformanceInput = {
  dateFrom: Date;
  dateTo: Date;
  currency: Currency;
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
  currency: Currency;
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
  currency: Currency;
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
  currency: Currency;
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
  };
};

export type WalletCustomer360DetailInput = {
  customerId: string;
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
  currency: Currency;
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
  };
};

export type WalletInsightsAlertsInput = {
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
  currency: Currency;
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

// Deposit and withdrawal transaction type classifications per currency
const DEPOSIT_TYPES: Record<Currency, readonly string[]> = {
  USD: ["Cash In credit"],
  ZWL: ["ZIPIT-Receive", "Transfer-Receive", "B2W Credit"],
};

const WITHDRAWAL_TYPES: Record<Currency, readonly string[]> = {
  USD: ["Withdrawal (CashOut)"],
  ZWL: ["ZIPIT-Send", "Transfer-Send-Omari", "W2B Debit"],
};

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
  if (daysSinceLastActivity > 90) return "dormant";
  if (daysSinceLastActivity > 30) return "watch";
  return "active";
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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
    throw new WalletServiceError("Source SQL metrics connection is not configured.", 503);
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

// Build safe SQL IN list from hardcoded constant string arrays only
function sqlInList(items: readonly string[]): string {
  return items.map((item) => `'${item.replace(/'/g, "''")}'`).join(", ");
}

function getTxTable(): QualifiedTableName {
  return parseQualifiedTableName(env.SOURCE_SQL_TRANSACTIONS_TABLE);
}

function getCustomerTable(): QualifiedTableName {
  return parseQualifiedTableName(env.SOURCE_SQL_CUSTOMER_TABLE);
}

function getAccountsTable(currency: Currency): QualifiedTableName {
  return parseQualifiedTableName(
    currency === "USD" ? env.SOURCE_SQL_USD_ACCOUNTS_TABLE : env.SOURCE_SQL_ZWL_ACCOUNTS_TABLE,
  );
}

// For USD: use the current-snapshot table; for ZWL: use the historical table (no dedicated current table)
function getBalanceCurrentTable(currency: Currency): QualifiedTableName {
  return parseQualifiedTableName(
    currency === "USD"
      ? env.SOURCE_SQL_USD_BALANCE_CURRENT_TABLE
      : env.SOURCE_SQL_ZWL_BALANCE_TABLE,
  );
}

function getBalanceHistoryTable(currency: Currency): QualifiedTableName {
  return parseQualifiedTableName(
    currency === "USD" ? env.SOURCE_SQL_AGENT_BALANCE_TABLE : env.SOURCE_SQL_ZWL_BALANCE_TABLE,
  );
}

function buildComparisonKpi(current: number, previous: number): WalletComparisonKpi {
  const absoluteChange = current - previous;
  const percentChange = previous === 0 ? null : (absoluteChange / previous) * 100;
  return { previousValue: previous, absoluteChange, percentChange };
}

function mapTransactionTrendRow(row: Record<string, unknown>): WalletTransactionTrendPoint {
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
    valuePerActiveCustomer: activeCustomers === 0 ? 0 : totalTransactionValue / activeCustomers,
    volumePerActiveCustomer: activeCustomers === 0 ? 0 : totalTransactionVolume / activeCustomers,
  };
}

function mapRevenueTrendRow(row: Record<string, unknown>): WalletRevenueTrendPoint {
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
    commissionPerTransaction: totalTransactionVolume === 0 ? 0 : totalCommission / totalTransactionVolume,
    commissionPerActiveCustomer: activeCustomers === 0 ? 0 : totalCommission / activeCustomers,
    commissionRate: totalTransactionValue === 0 ? 0 : (totalCommission / totalTransactionValue) * 100,
  };
}

function mapCustomer360Summary(row: Record<string, unknown>, asOfDate: Date): WalletCustomer360Summary {
  const firstSeenDate = row.firstSeenDate instanceof Date ? row.firstSeenDate : new Date(String(row.firstSeenDate));
  const lastSeenDate = row.lastSeenDate instanceof Date ? row.lastSeenDate : new Date(String(row.lastSeenDate));
  const daysSinceLastActivity = daysBetween(lastSeenDate, asOfDate);
  return {
    customerId: String(row.customerId),
    fullName: row.fullName === null || row.fullName === undefined ? null : String(row.fullName).trim() || null,
    mobileNumber: row.mobileNumber === null || row.mobileNumber === undefined ? null : String(row.mobileNumber).trim() || null,
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

// ─── Transaction KPIs ────────────────────────────────────────────────────────

async function queryTransactionKpis(params: {
  currency: Currency;
  dateFrom: Date;
  dateTo: Date;
}): Promise<Pick<WalletKpis, "totalTransactionValue" | "totalTransactionVolume" | "totalCommission">> {
  const pool = await getPool();
  const tx = getTxTable();
  const depositIn = sqlInList(DEPOSIT_TYPES[params.currency]);
  const withdrawalIn = sqlInList(WITHDRAWAL_TYPES[params.currency]);
  const request = pool.request();
  request.input("currency", sql.NVarChar(10), params.currency);
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const result = await request.query(`
    SELECT
      COALESCE(SUM(CASE WHEN [TransactionType] IN (${depositIn}) THEN [TransactionAmount] ELSE 0 END), 0) AS depositValue,
      COALESCE(SUM(CASE WHEN [TransactionType] IN (${withdrawalIn}) THEN [TransactionAmount] ELSE 0 END), 0) AS withdrawalValue,
      COALESCE(SUM([TransactionAmount]), 0) AS totalTransactionValue,
      COALESCE(SUM([Volume]), 0) AS totalTransactionVolume,
      COALESCE(ABS(SUM(CASE WHEN [NetFee] < 0 THEN [NetFee] ELSE 0 END)), 0) AS totalCommission
    FROM [${tx.schema}].[${tx.table}] WITH (NOLOCK)
    WHERE [Currency] = @currency
      AND CAST([Date] AS DATE) >= @dateFrom
      AND CAST([Date] AS DATE) <= @dateTo
  `);

  const row = (result.recordset[0] ?? {}) as NumericRecord;
  return {
    totalTransactionValue: toNumber(row.totalTransactionValue),
    totalTransactionVolume: Math.trunc(toNumber(row.totalTransactionVolume)),
    totalCommission: toNumber(row.totalCommission),
  };
}

// ─── Customer KPIs ───────────────────────────────────────────────────────────

async function queryCustomerKpis(params: {
  currency: Currency;
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
}): Promise<Pick<WalletKpis, "activeCustomersA30" | "activeCustomersA60" | "newCustomers" | "dormantCustomers90Plus">> {
  const pool = await getPool();
  const tx = getTxTable();
  const acct = getAccountsTable(params.currency);
  const a30Date = addDays(params.asOfDate, -29);
  const a60Date = addDays(params.asOfDate, -59);
  const dormantCutoff = addDays(params.asOfDate, -90);

  const reqA30 = pool.request();
  reqA30.input("currency", sql.NVarChar(10), params.currency);
  reqA30.input("a30Date", sql.Date, a30Date);
  reqA30.input("asOfDate", sql.Date, params.asOfDate);

  const reqA60 = pool.request();
  reqA60.input("currency", sql.NVarChar(10), params.currency);
  reqA60.input("a60Date", sql.Date, a60Date);
  reqA60.input("asOfDate", sql.Date, params.asOfDate);

  const reqNew = pool.request();
  reqNew.input("currency", sql.NVarChar(10), params.currency);
  reqNew.input("dateFrom", sql.Date, params.dateFrom);
  reqNew.input("dateTo", sql.Date, params.dateTo);

  const reqDormant = pool.request();
  reqDormant.input("currency", sql.NVarChar(10), params.currency);
  reqDormant.input("dormantCutoff", sql.Date, dormantCutoff);
  reqDormant.input("asOfDate", sql.Date, params.asOfDate);

  const [resA30, resA60, resNew, resDormant] = await Promise.all([
    reqA30.query(`
      SELECT COUNT(DISTINCT a.[CIF]) AS activeCustomersA30
      FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
      JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
      WHERE t.[Currency] = @currency
        AND CAST(t.[Date] AS DATE) >= @a30Date
        AND CAST(t.[Date] AS DATE) <= @asOfDate
        AND a.[CIF] IS NOT NULL
    `),
    reqA60.query(`
      SELECT COUNT(DISTINCT a.[CIF]) AS activeCustomersA60
      FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
      JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
      WHERE t.[Currency] = @currency
        AND CAST(t.[Date] AS DATE) >= @a60Date
        AND CAST(t.[Date] AS DATE) <= @asOfDate
        AND a.[CIF] IS NOT NULL
    `),
    reqNew.query(`
      SELECT COUNT(*) AS newCustomers
      FROM (
        SELECT a.[CIF], MIN(CAST(t.[Date] AS DATE)) AS firstDate
        FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
        JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
        WHERE t.[Currency] = @currency AND a.[CIF] IS NOT NULL
        GROUP BY a.[CIF]
      ) first_seen
      WHERE firstDate >= @dateFrom AND firstDate <= @dateTo
    `),
    reqDormant.query(`
      SELECT COUNT(*) AS dormantCustomers90Plus
      FROM (
        SELECT a.[CIF], MAX(CAST(t.[Date] AS DATE)) AS lastDate
        FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
        JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
        WHERE t.[Currency] = @currency
          AND CAST(t.[Date] AS DATE) <= @asOfDate
          AND a.[CIF] IS NOT NULL
        GROUP BY a.[CIF]
      ) last_seen
      WHERE lastDate < @dormantCutoff
    `),
  ]);

  return {
    activeCustomersA30: Math.trunc(toNumber((resA30.recordset[0] as NumericRecord).activeCustomersA30)),
    activeCustomersA60: Math.trunc(toNumber((resA60.recordset[0] as NumericRecord).activeCustomersA60)),
    newCustomers: Math.trunc(toNumber((resNew.recordset[0] as NumericRecord).newCustomers)),
    dormantCustomers90Plus: Math.trunc(toNumber((resDormant.recordset[0] as NumericRecord).dormantCustomers90Plus)),
  };
}

// ─── E-Float (Balance) ───────────────────────────────────────────────────────

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
  currency: Currency;
  asOfDate: Date;
}): Promise<{ latestTotalEFloat: number; latestEFloatDate: string | null }> {
  const currentTable = getBalanceCurrentTable(params.currency);
  const fromCurrent = await queryLatestEFloat({ table: currentTable, asOfDate: params.asOfDate });
  if (fromCurrent.latestEFloatDate) return fromCurrent;
  const historyTable = getBalanceHistoryTable(params.currency);
  return queryLatestEFloat({ table: historyTable, asOfDate: params.asOfDate });
}

// ─── Activity Trend ──────────────────────────────────────────────────────────

async function queryActivityTrend(params: {
  currency: Currency;
  dateFrom: Date;
  dateTo: Date;
  grain: "daily" | "monthly";
}): Promise<Array<{ period: string; activeCustomers: number; newCustomers: number; transactionVolume: number }>> {
  const pool = await getPool();
  const tx = getTxTable();
  const acct = getAccountsTable(params.currency);
  const request = pool.request();
  request.input("currency", sql.NVarChar(10), params.currency);
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const periodExpr =
    params.grain === "daily"
      ? "CONVERT(VARCHAR(10), CAST(t.[Date] AS DATE), 23)"
      : "CONVERT(CHAR(7), CAST(t.[Date] AS DATE), 120)";

  const result = await request.query(`
    WITH customer_first AS (
      SELECT a.[CIF], MIN(CAST(t.[Date] AS DATE)) AS firstDate
      FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
      JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
      WHERE t.[Currency] = @currency AND a.[CIF] IS NOT NULL
      GROUP BY a.[CIF]
    ),
    period_data AS (
      SELECT
        ${periodExpr} AS period,
        a.[CIF] AS cif,
        SUM(t.[Volume]) AS txVolume
      FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
      JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
      WHERE t.[Currency] = @currency
        AND CAST(t.[Date] AS DATE) >= @dateFrom
        AND CAST(t.[Date] AS DATE) <= @dateTo
        AND a.[CIF] IS NOT NULL
      GROUP BY ${periodExpr}, a.[CIF]
    )
    SELECT
      p.period,
      COUNT(DISTINCT p.cif) AS activeCustomers,
      COUNT(DISTINCT CASE WHEN cf.firstDate >= @dateFrom AND cf.firstDate <= @dateTo
        AND ${params.grain === "daily" ? "CONVERT(VARCHAR(10), cf.firstDate, 23)" : "CONVERT(CHAR(7), cf.firstDate, 120)"} = p.period
        THEN p.cif END) AS newCustomers,
      COALESCE(SUM(p.txVolume), 0) AS transactionVolume
    FROM period_data p
    JOIN customer_first cf ON p.cif = cf.cif
    GROUP BY p.period
    ORDER BY p.period ASC
  `);

  return (result.recordset as Array<Record<string, unknown>>).map((row) => ({
    period: String(row.period),
    activeCustomers: Math.trunc(toNumber(row.activeCustomers)),
    newCustomers: Math.trunc(toNumber(row.newCustomers)),
    transactionVolume: Math.trunc(toNumber(row.transactionVolume)),
  }));
}

async function queryFrequencyBuckets(params: {
  currency: Currency;
  dateFrom: Date;
  dateTo: Date;
}): Promise<WalletCustomerFrequencyBucket[]> {
  const pool = await getPool();
  const tx = getTxTable();
  const acct = getAccountsTable(params.currency);
  const request = pool.request();
  request.input("currency", sql.NVarChar(10), params.currency);
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const result = await request.query(`
    WITH customer_frequency AS (
      SELECT a.[CIF] AS customerId, COALESCE(SUM(t.[Volume]), 0) AS transactionCount
      FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
      JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
      WHERE t.[Currency] = @currency
        AND CAST(t.[Date] AS DATE) >= @dateFrom
        AND CAST(t.[Date] AS DATE) <= @dateTo
        AND a.[CIF] IS NOT NULL
      GROUP BY a.[CIF]
    )
    SELECT
      CASE
        WHEN transactionCount <= 1 THEN '1 tx'
        WHEN transactionCount BETWEEN 2 AND 5 THEN '2-5 tx'
        WHEN transactionCount BETWEEN 6 AND 20 THEN '6-20 tx'
        ELSE '20+ tx'
      END AS bucket,
      COUNT(*) AS customers
    FROM customer_frequency
    GROUP BY
      CASE
        WHEN transactionCount <= 1 THEN '1 tx'
        WHEN transactionCount BETWEEN 2 AND 5 THEN '2-5 tx'
        WHEN transactionCount BETWEEN 6 AND 20 THEN '6-20 tx'
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

// ─── Transaction Performance ─────────────────────────────────────────────────

async function queryTransactionPerformanceTrend(params: {
  currency: Currency;
  dateFrom: Date;
  dateTo: Date;
  grain: "daily" | "monthly";
}): Promise<WalletTransactionTrendPoint[]> {
  const pool = await getPool();
  const tx = getTxTable();
  const acct = getAccountsTable(params.currency);
  const depositIn = sqlInList(DEPOSIT_TYPES[params.currency]);
  const withdrawalIn = sqlInList(WITHDRAWAL_TYPES[params.currency]);
  const request = pool.request();
  request.input("currency", sql.NVarChar(10), params.currency);
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const periodExpr =
    params.grain === "daily"
      ? "CONVERT(VARCHAR(10), CAST(t.[Date] AS DATE), 23)"
      : "CONVERT(CHAR(7), CAST(t.[Date] AS DATE), 120)";

  const result = await request.query(`
    SELECT
      ${periodExpr} AS period,
      COALESCE(SUM(CASE WHEN t.[TransactionType] IN (${depositIn}) THEN t.[TransactionAmount] ELSE 0 END), 0) AS depositValue,
      COALESCE(SUM(CASE WHEN t.[TransactionType] IN (${withdrawalIn}) THEN t.[TransactionAmount] ELSE 0 END), 0) AS withdrawalValue,
      COALESCE(SUM(CASE WHEN t.[TransactionType] IN (${depositIn}) THEN t.[Volume] ELSE 0 END), 0) AS depositVolume,
      COALESCE(SUM(CASE WHEN t.[TransactionType] IN (${withdrawalIn}) THEN t.[Volume] ELSE 0 END), 0) AS withdrawalVolume,
      COALESCE(SUM(t.[TransactionAmount]), 0) AS totalTransactionValue,
      COALESCE(SUM(t.[Volume]), 0) AS totalTransactionVolume,
      COUNT(DISTINCT a.[CIF]) AS activeCustomers
    FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
    JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
    WHERE t.[Currency] = @currency
      AND CAST(t.[Date] AS DATE) >= @dateFrom
      AND CAST(t.[Date] AS DATE) <= @dateTo
      AND a.[CIF] IS NOT NULL
    GROUP BY ${periodExpr}
    ORDER BY period ASC
  `);

  return (result.recordset as Array<Record<string, unknown>>).map(mapTransactionTrendRow);
}

async function queryTransactionPerformanceKpis(params: {
  currency: Currency;
  dateFrom: Date;
  dateTo: Date;
}): Promise<WalletTransactionPerformanceResponse["kpis"]> {
  const pool = await getPool();
  const tx = getTxTable();
  const acct = getAccountsTable(params.currency);
  const depositIn = sqlInList(DEPOSIT_TYPES[params.currency]);
  const withdrawalIn = sqlInList(WITHDRAWAL_TYPES[params.currency]);
  const request = pool.request();
  request.input("currency", sql.NVarChar(10), params.currency);
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const result = await request.query(`
    SELECT
      COALESCE(SUM(CASE WHEN t.[TransactionType] IN (${depositIn}) THEN t.[TransactionAmount] ELSE 0 END), 0) AS depositValue,
      COALESCE(SUM(CASE WHEN t.[TransactionType] IN (${withdrawalIn}) THEN t.[TransactionAmount] ELSE 0 END), 0) AS withdrawalValue,
      COALESCE(SUM(CASE WHEN t.[TransactionType] IN (${depositIn}) THEN t.[Volume] ELSE 0 END), 0) AS depositVolume,
      COALESCE(SUM(CASE WHEN t.[TransactionType] IN (${withdrawalIn}) THEN t.[Volume] ELSE 0 END), 0) AS withdrawalVolume,
      COALESCE(SUM(t.[TransactionAmount]), 0) AS totalTransactionValue,
      COALESCE(SUM(t.[Volume]), 0) AS totalTransactionVolume,
      COUNT(DISTINCT a.[CIF]) AS activeCustomers
    FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
    JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
    WHERE t.[Currency] = @currency
      AND CAST(t.[Date] AS DATE) >= @dateFrom
      AND CAST(t.[Date] AS DATE) <= @dateTo
      AND a.[CIF] IS NOT NULL
  `);

  const row = (result.recordset[0] ?? {}) as NumericRecord;
  const mapped = mapTransactionTrendRow({ ...row, period: "" });
  return {
    depositValue: mapped.depositValue,
    withdrawalValue: mapped.withdrawalValue,
    netFlowValue: mapped.netFlowValue,
    depositVolume: mapped.depositVolume,
    withdrawalVolume: mapped.withdrawalVolume,
    totalTransactionValue: mapped.totalTransactionValue,
    totalTransactionVolume: mapped.totalTransactionVolume,
    activeCustomers: mapped.activeCustomers,
    valuePerActiveCustomer: mapped.valuePerActiveCustomer,
    volumePerActiveCustomer: mapped.volumePerActiveCustomer,
  };
}

// ─── Revenue Performance ─────────────────────────────────────────────────────

async function queryRevenuePerformanceTrend(params: {
  currency: Currency;
  dateFrom: Date;
  dateTo: Date;
  grain: "daily" | "monthly";
}): Promise<WalletRevenueTrendPoint[]> {
  const pool = await getPool();
  const tx = getTxTable();
  const acct = getAccountsTable(params.currency);
  const depositIn = sqlInList(DEPOSIT_TYPES[params.currency]);
  const withdrawalIn = sqlInList(WITHDRAWAL_TYPES[params.currency]);
  const request = pool.request();
  request.input("currency", sql.NVarChar(10), params.currency);
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const periodExpr =
    params.grain === "daily"
      ? "CONVERT(VARCHAR(10), CAST(t.[Date] AS DATE), 23)"
      : "CONVERT(CHAR(7), CAST(t.[Date] AS DATE), 120)";

  const result = await request.query(`
    SELECT
      ${periodExpr} AS period,
      COALESCE(ABS(SUM(CASE WHEN t.[NetFee] < 0 THEN t.[NetFee] ELSE 0 END)), 0) AS totalCommission,
      COALESCE(ABS(SUM(CASE WHEN t.[TransactionType] IN (${depositIn}) AND t.[NetFee] < 0 THEN t.[NetFee] ELSE 0 END)), 0) AS depositCommission,
      COALESCE(ABS(SUM(CASE WHEN t.[TransactionType] IN (${withdrawalIn}) AND t.[NetFee] < 0 THEN t.[NetFee] ELSE 0 END)), 0) AS withdrawalCommission,
      COALESCE(SUM(t.[TransactionAmount]), 0) AS totalTransactionValue,
      COALESCE(SUM(t.[Volume]), 0) AS totalTransactionVolume,
      COUNT(DISTINCT a.[CIF]) AS activeCustomers
    FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
    JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
    WHERE t.[Currency] = @currency
      AND CAST(t.[Date] AS DATE) >= @dateFrom
      AND CAST(t.[Date] AS DATE) <= @dateTo
      AND a.[CIF] IS NOT NULL
    GROUP BY ${periodExpr}
    ORDER BY period ASC
  `);

  return (result.recordset as Array<Record<string, unknown>>).map(mapRevenueTrendRow);
}

async function queryRevenuePerformanceKpis(params: {
  currency: Currency;
  dateFrom: Date;
  dateTo: Date;
}): Promise<WalletRevenuePerformanceResponse["kpis"]> {
  const pool = await getPool();
  const tx = getTxTable();
  const acct = getAccountsTable(params.currency);
  const depositIn = sqlInList(DEPOSIT_TYPES[params.currency]);
  const withdrawalIn = sqlInList(WITHDRAWAL_TYPES[params.currency]);
  const request = pool.request();
  request.input("currency", sql.NVarChar(10), params.currency);
  request.input("dateFrom", sql.Date, params.dateFrom);
  request.input("dateTo", sql.Date, params.dateTo);

  const result = await request.query(`
    SELECT
      COALESCE(ABS(SUM(CASE WHEN t.[NetFee] < 0 THEN t.[NetFee] ELSE 0 END)), 0) AS totalCommission,
      COALESCE(ABS(SUM(CASE WHEN t.[TransactionType] IN (${depositIn}) AND t.[NetFee] < 0 THEN t.[NetFee] ELSE 0 END)), 0) AS depositCommission,
      COALESCE(ABS(SUM(CASE WHEN t.[TransactionType] IN (${withdrawalIn}) AND t.[NetFee] < 0 THEN t.[NetFee] ELSE 0 END)), 0) AS withdrawalCommission,
      COALESCE(SUM(t.[TransactionAmount]), 0) AS totalTransactionValue,
      COALESCE(SUM(t.[Volume]), 0) AS totalTransactionVolume,
      COUNT(DISTINCT a.[CIF]) AS activeCustomers
    FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
    JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
    WHERE t.[Currency] = @currency
      AND CAST(t.[Date] AS DATE) >= @dateFrom
      AND CAST(t.[Date] AS DATE) <= @dateTo
      AND a.[CIF] IS NOT NULL
  `);

  const row = (result.recordset[0] ?? {}) as NumericRecord;
  const mapped = mapRevenueTrendRow({ ...row, period: "" });
  return {
    totalCommission: mapped.totalCommission,
    depositCommission: mapped.depositCommission,
    withdrawalCommission: mapped.withdrawalCommission,
    totalTransactionValue: mapped.totalTransactionValue,
    totalTransactionVolume: mapped.totalTransactionVolume,
    activeCustomers: mapped.activeCustomers,
    commissionPerTransaction: mapped.commissionPerTransaction,
    commissionPerActiveCustomer: mapped.commissionPerActiveCustomer,
    commissionRate: mapped.commissionRate,
  };
}

// ─── Liquidity ───────────────────────────────────────────────────────────────

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
    top10BalanceConcentration: latestTotalEFloat === 0 ? 0 : (top10BalanceTotal / latestTotalEFloat) * 100,
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

// ─── Retention / Dormancy ────────────────────────────────────────────────────

async function queryRetentionDormancy(params: {
  currency: Currency;
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
  const pool = await getPool();
  const tx = getTxTable();
  const acct = getAccountsTable(params.currency);
  const a30Date = addDays(params.asOfDate, -29);
  const dormantCutoff = addDays(params.asOfDate, -90);

  const reqSummary = pool.request();
  reqSummary.input("currency", sql.NVarChar(10), params.currency);
  reqSummary.input("asOfDate", sql.Date, params.asOfDate);
  reqSummary.input("a30Date", sql.Date, a30Date);
  reqSummary.input("dormantCutoff", sql.Date, dormantCutoff);

  const reqBuckets = pool.request();
  reqBuckets.input("currency", sql.NVarChar(10), params.currency);
  reqBuckets.input("asOfDate", sql.Date, params.asOfDate);

  const reqReactivation = pool.request();
  reqReactivation.input("currency", sql.NVarChar(10), params.currency);
  reqReactivation.input("dateFrom", sql.Date, params.dateFrom);
  reqReactivation.input("dateTo", sql.Date, params.dateTo);

  const reqCohorts = pool.request();
  reqCohorts.input("currency", sql.NVarChar(10), params.currency);
  reqCohorts.input("asOfDate", sql.Date, params.asOfDate);
  reqCohorts.input("a30Date", sql.Date, a30Date);
  reqCohorts.input("dormantCutoff", sql.Date, dormantCutoff);

  const customerLastSeen = `
    (SELECT a.[CIF], MAX(CAST(t.[Date] AS DATE)) AS lastDate, MIN(CAST(t.[Date] AS DATE)) AS firstDate
     FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
     JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
     WHERE t.[Currency] = @currency AND a.[CIF] IS NOT NULL
     GROUP BY a.[CIF]) cls
  `;

  const [resSummary, resBuckets, resReactivation, resCohorts] = await Promise.all([
    reqSummary.query(`
      SELECT
        COUNT(*) AS totalCustomers,
        SUM(CASE WHEN cls.lastDate >= @a30Date AND cls.lastDate <= @asOfDate THEN 1 ELSE 0 END) AS activeCustomersA30,
        SUM(CASE WHEN cls.lastDate < @dormantCutoff THEN 1 ELSE 0 END) AS dormantCustomers90Plus
      FROM ${customerLastSeen}
      WHERE cls.lastDate <= @asOfDate
    `),
    reqBuckets.query(`
      SELECT
        CASE
          WHEN DATEDIFF(DAY, cls.lastDate, @asOfDate) BETWEEN 0 AND 7 THEN '0-7 days'
          WHEN DATEDIFF(DAY, cls.lastDate, @asOfDate) BETWEEN 8 AND 30 THEN '8-30 days'
          WHEN DATEDIFF(DAY, cls.lastDate, @asOfDate) BETWEEN 31 AND 60 THEN '31-60 days'
          WHEN DATEDIFF(DAY, cls.lastDate, @asOfDate) BETWEEN 61 AND 90 THEN '61-90 days'
          ELSE '90+ days'
        END AS bucket,
        COUNT(*) AS customers
      FROM ${customerLastSeen}
      WHERE cls.lastDate <= @asOfDate
      GROUP BY
        CASE
          WHEN DATEDIFF(DAY, cls.lastDate, @asOfDate) BETWEEN 0 AND 7 THEN '0-7 days'
          WHEN DATEDIFF(DAY, cls.lastDate, @asOfDate) BETWEEN 8 AND 30 THEN '8-30 days'
          WHEN DATEDIFF(DAY, cls.lastDate, @asOfDate) BETWEEN 31 AND 60 THEN '31-60 days'
          WHEN DATEDIFF(DAY, cls.lastDate, @asOfDate) BETWEEN 61 AND 90 THEN '61-90 days'
          ELSE '90+ days'
        END
    `),
    reqReactivation.query(`
      WITH customer_gaps AS (
        SELECT
          a.[CIF],
          CAST(t.[Date] AS DATE) AS txDate,
          LAG(CAST(t.[Date] AS DATE)) OVER (PARTITION BY a.[CIF] ORDER BY CAST(t.[Date] AS DATE)) AS prevDate
        FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
        JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
        WHERE t.[Currency] = @currency AND a.[CIF] IS NOT NULL
      )
      SELECT
        CONVERT(VARCHAR(10), txDate, 23) AS period,
        COUNT(DISTINCT [CIF]) AS reactivatedCustomers
      FROM customer_gaps
      WHERE txDate >= @dateFrom
        AND txDate <= @dateTo
        AND prevDate IS NOT NULL
        AND DATEDIFF(DAY, prevDate, txDate) > 90
      GROUP BY CONVERT(VARCHAR(10), txDate, 23)
      ORDER BY period ASC
    `),
    reqCohorts.query(`
      SELECT
        CONVERT(CHAR(7), cls.firstDate, 120) AS cohortMonth,
        COUNT(*) AS customers,
        SUM(CASE WHEN cls.lastDate >= @a30Date AND cls.lastDate <= @asOfDate THEN 1 ELSE 0 END) AS active30Customers,
        SUM(CASE WHEN cls.lastDate < @dormantCutoff THEN 1 ELSE 0 END) AS dormant90Customers
      FROM ${customerLastSeen}
      WHERE cls.firstDate <= @asOfDate
      GROUP BY CONVERT(CHAR(7), cls.firstDate, 120)
      ORDER BY cohortMonth DESC
    `),
  ]);

  const summary = (resSummary.recordset[0] ?? {}) as NumericRecord;
  const byBucket = new Map(
    (resBuckets.recordset as Array<Record<string, unknown>>).map((row) => [
      String(row.bucket),
      Math.trunc(toNumber(row.customers)),
    ]),
  );

  return {
    totalCustomers: Math.trunc(toNumber(summary.totalCustomers)),
    activeCustomersA30: Math.trunc(toNumber(summary.activeCustomersA30)),
    dormantCustomers90Plus: Math.trunc(toNumber(summary.dormantCustomers90Plus)),
    inactivityBuckets: (["0-7 days", "8-30 days", "31-60 days", "61-90 days", "90+ days"] as const).map((bucket) => ({
      bucket,
      customers: byBucket.get(bucket) ?? 0,
    })),
    reactivationTrend: (resReactivation.recordset as Array<Record<string, unknown>>).map((row) => ({
      period: String(row.period),
      reactivatedCustomers: Math.trunc(toNumber(row.reactivatedCustomers)),
    })),
    cohorts: (resCohorts.recordset as Array<Record<string, unknown>>).map((row) => {
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

// ─── Customer 360 ─────────────────────────────────────────────────────────────

async function queryCustomer360List(params: {
  currency: Currency;
  search?: string;
  status?: "all" | "active_a30" | "dormant_90";
  asOfDate: Date;
  page: number;
  pageSize: number;
}): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
  const pool = await getPool();
  const tx = getTxTable();
  const acct = getAccountsTable(params.currency);
  const cust = getCustomerTable();
  const last30 = addDays(params.asOfDate, -29);
  const last60 = addDays(params.asOfDate, -59);
  const dormantCutoff = addDays(params.asOfDate, -90);
  const offset = (params.page - 1) * params.pageSize;

  const reqCount = pool.request();
  reqCount.input("currency", sql.NVarChar(10), params.currency);
  reqCount.input("asOfDate", sql.Date, params.asOfDate);
  if (params.status === "active_a30") reqCount.input("statusDate", sql.Date, last30);
  if (params.status === "dormant_90") reqCount.input("statusDate", sql.Date, dormantCutoff);

  const reqItems = pool.request();
  reqItems.input("currency", sql.NVarChar(10), params.currency);
  reqItems.input("asOfDate", sql.Date, params.asOfDate);
  reqItems.input("last30", sql.Date, last30);
  reqItems.input("last60", sql.Date, last60);
  reqItems.input("offset", sql.Int, offset);
  reqItems.input("pageSize", sql.Int, params.pageSize);
  if (params.status === "active_a30") reqItems.input("statusDate", sql.Date, last30);
  if (params.status === "dormant_90") reqItems.input("statusDate", sql.Date, dormantCutoff);

  const searchClause = params.search?.trim()
    ? `AND (c.[CIF] LIKE '%${params.search.trim().replace(/'/g, "''")}%'
         OR CONCAT(c.[FirstName], ' ', c.[LastName]) LIKE '%${params.search.trim().replace(/'/g, "''")}%'
         OR c.[MobileNumber] LIKE '%${params.search.trim().replace(/'/g, "''")}%')`
    : "";

  const statusClause =
    params.status === "active_a30"
      ? "AND cls.lastDate >= @statusDate AND cls.lastDate <= @asOfDate"
      : params.status === "dormant_90"
        ? "AND cls.lastDate < @statusDate"
        : "";

  const [resCount, resItems] = await Promise.all([
    reqCount.query(`
      WITH customer_stats AS (
        SELECT a.[CIF], MAX(CAST(t.[Date] AS DATE)) AS lastDate
        FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
        JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
        WHERE t.[Currency] = @currency AND a.[CIF] IS NOT NULL
        GROUP BY a.[CIF]
      )
      SELECT COUNT(*) AS total FROM customer_stats cls
      JOIN [${cust.schema}].[${cust.table}] c WITH (NOLOCK) ON cls.[CIF] = c.[CIF]
      WHERE cls.lastDate <= @asOfDate ${searchClause} ${statusClause}
    `),  reqItems.query(`
      WITH customer_stats AS (
        SELECT
          a.[CIF],
          MIN(CAST(t.[Date] AS DATE)) AS firstDate,
          MAX(CAST(t.[Date] AS DATE)) AS lastDate,
          SUM(t.[TransactionAmount]) AS lifetimeValue,
          SUM(t.[Volume]) AS lifetimeVolume,
          ABS(SUM(CASE WHEN t.[NetFee] < 0 THEN t.[NetFee] ELSE 0 END)) AS lifetimeCommission,
          SUM(CASE WHEN CAST(t.[Date] AS DATE) >= @last30 THEN t.[TransactionAmount] ELSE 0 END) AS last30Value,
          SUM(CASE WHEN CAST(t.[Date] AS DATE) >= @last60 THEN t.[TransactionAmount] ELSE 0 END) AS last60Value
        FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
        JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
        WHERE t.[Currency] = @currency AND a.[CIF] IS NOT NULL
        GROUP BY a.[CIF]
      )
      SELECT
        cls.[CIF] AS customerId,
        CONCAT(LTRIM(RTRIM(c.[FirstName])), ' ', LTRIM(RTRIM(c.[LastName]))) AS fullName,
        c.[MobileNumber] AS mobileNumber,
        cls.firstDate AS firstSeenDate,
        cls.lastDate AS lastSeenDate,
        cls.lifetimeValue AS lifetimeTransactionValue,
        cls.lifetimeVolume AS lifetimeTransactionVolume,
        cls.lifetimeCommission,
        cls.last30Value AS last30DayTransactionValue,
        cls.last60Value AS last60DayTransactionValue
      FROM customer_stats cls
      JOIN [${cust.schema}].[${cust.table}] c WITH (NOLOCK) ON cls.[CIF] = c.[CIF]
      WHERE cls.lastDate <= @asOfDate ${searchClause} ${statusClause}
      ORDER BY cls.lifetimeValue DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `),
  ]);

  return {
    total: Math.trunc(toNumber((resCount.recordset[0] as NumericRecord).total)),
    items: resItems.recordset as Array<Record<string, unknown>>,
  };
}

async function queryCustomer360Detail(params: {
  currency: Currency;
  customerId: string;
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
}): Promise<{
  customer: Record<string, unknown> | null;
  kpis: WalletCustomer360DetailResponse["kpis"];
  dailyTrend: WalletCustomer360TrendPoint[];
}> {
  const pool = await getPool();
  const tx = getTxTable();
  const acct = getAccountsTable(params.currency);
  const cust = getCustomerTable();
  const depositIn = sqlInList(DEPOSIT_TYPES[params.currency]);
  const withdrawalIn = sqlInList(WITHDRAWAL_TYPES[params.currency]);
  const last30 = addDays(params.asOfDate, -29);
  const last60 = addDays(params.asOfDate, -59);
  const last90Date = addDays(params.asOfDate, -89);

  const reqProfile = pool.request();
  reqProfile.input("currency", sql.NVarChar(10), params.currency);
  reqProfile.input("customerId", sql.NVarChar(120), params.customerId);
  reqProfile.input("asOfDate", sql.Date, params.asOfDate);
  reqProfile.input("last30", sql.Date, last30);
  reqProfile.input("last60", sql.Date, last60);

  const reqKpis = pool.request();
  reqKpis.input("currency", sql.NVarChar(10), params.currency);
  reqKpis.input("customerId", sql.NVarChar(120), params.customerId);
  reqKpis.input("dateFrom", sql.Date, params.dateFrom);
  reqKpis.input("dateTo", sql.Date, params.dateTo);
  reqKpis.input("last90Date", sql.Date, last90Date);
  reqKpis.input("asOfDate", sql.Date, params.asOfDate);

  const reqTrend = pool.request();
  reqTrend.input("currency", sql.NVarChar(10), params.currency);
  reqTrend.input("customerId", sql.NVarChar(120), params.customerId);
  reqTrend.input("dateFrom", sql.Date, params.dateFrom);
  reqTrend.input("dateTo", sql.Date, params.dateTo);

  const [resProfile, resKpis, resTrend] = await Promise.all([
    reqProfile.query(`
      SELECT
        c.[CIF] AS customerId,
        CONCAT(LTRIM(RTRIM(c.[FirstName])), ' ', LTRIM(RTRIM(c.[LastName]))) AS fullName,
        c.[MobileNumber] AS mobileNumber,
        MIN(CAST(t.[Date] AS DATE)) AS firstSeenDate,
        MAX(CAST(t.[Date] AS DATE)) AS lastSeenDate,
        SUM(t.[TransactionAmount]) AS lifetimeTransactionValue,
        SUM(t.[Volume]) AS lifetimeTransactionVolume,
        ABS(SUM(CASE WHEN t.[NetFee] < 0 THEN t.[NetFee] ELSE 0 END)) AS lifetimeCommission,
        SUM(CASE WHEN CAST(t.[Date] AS DATE) >= @last30 THEN t.[TransactionAmount] ELSE 0 END) AS last30DayTransactionValue,
        SUM(CASE WHEN CAST(t.[Date] AS DATE) >= @last60 THEN t.[TransactionAmount] ELSE 0 END) AS last60DayTransactionValue
      FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
      JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
      JOIN [${cust.schema}].[${cust.table}] c WITH (NOLOCK) ON a.[CIF] = c.[CIF]
      WHERE t.[Currency] = @currency
        AND c.[CIF] = @customerId
        AND CAST(t.[Date] AS DATE) <= @asOfDate
      GROUP BY c.[CIF], c.[FirstName], c.[LastName], c.[MobileNumber]
    `),
    reqKpis.query(`
      SELECT
        COALESCE(SUM(CASE WHEN CAST(t.[Date] AS DATE) >= @dateFrom AND CAST(t.[Date] AS DATE) <= @dateTo THEN t.[TransactionAmount] ELSE 0 END), 0) AS selectedPeriodTransactionValue,
        COALESCE(SUM(CASE WHEN CAST(t.[Date] AS DATE) >= @dateFrom AND CAST(t.[Date] AS DATE) <= @dateTo THEN t.[Volume] ELSE 0 END), 0) AS selectedPeriodTransactionVolume,
        COALESCE(ABS(SUM(CASE WHEN CAST(t.[Date] AS DATE) >= @dateFrom AND CAST(t.[Date] AS DATE) <= @dateTo AND t.[NetFee] < 0 THEN t.[NetFee] ELSE 0 END)), 0) AS selectedPeriodCommission,
        COALESCE(SUM(CASE WHEN CAST(t.[Date] AS DATE) >= @last90Date AND CAST(t.[Date] AS DATE) <= @asOfDate THEN t.[TransactionAmount] ELSE 0 END), 0) AS last90DayTransactionValue,
        COALESCE(SUM(CASE WHEN CAST(t.[Date] AS DATE) >= @last90Date AND CAST(t.[Date] AS DATE) <= @asOfDate THEN t.[Volume] ELSE 0 END), 0) AS last90DayTransactionVolume
      FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
      JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
      WHERE t.[Currency] = @currency AND a.[CIF] = @customerId
    `),
    reqTrend.query(`
      SELECT
        CONVERT(VARCHAR(10), CAST(t.[Date] AS DATE), 23) AS period,
        COALESCE(SUM(t.[TransactionAmount]), 0) AS transactionValue,
        COALESCE(SUM(t.[Volume]), 0) AS transactionVolume,
        COALESCE(ABS(SUM(CASE WHEN t.[NetFee] < 0 THEN t.[NetFee] ELSE 0 END)), 0) AS commission,
        COALESCE(SUM(CASE WHEN t.[TransactionType] IN (${depositIn}) THEN t.[TransactionAmount] ELSE 0 END), 0) AS depositValue,
        COALESCE(SUM(CASE WHEN t.[TransactionType] IN (${withdrawalIn}) THEN t.[TransactionAmount] ELSE 0 END), 0) AS withdrawalValue
      FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
      JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
      WHERE t.[Currency] = @currency
        AND a.[CIF] = @customerId
        AND CAST(t.[Date] AS DATE) >= @dateFrom
        AND CAST(t.[Date] AS DATE) <= @dateTo
      GROUP BY CONVERT(VARCHAR(10), CAST(t.[Date] AS DATE), 23)
      ORDER BY period ASC
    `),
  ]);

  const profileRow = (resProfile.recordset[0] ?? null) as Record<string, unknown> | null;
  const kpiRow = (resKpis.recordset[0] ?? {}) as NumericRecord;
  const selectedPeriodTransactionValue = toNumber(kpiRow.selectedPeriodTransactionValue);
  const selectedPeriodTransactionVolume = Math.trunc(toNumber(kpiRow.selectedPeriodTransactionVolume));

  return {
    customer: profileRow,
    kpis: {
      selectedPeriodTransactionValue,
      selectedPeriodTransactionVolume,
      selectedPeriodCommission: toNumber(kpiRow.selectedPeriodCommission),
      last90DayTransactionValue: toNumber(kpiRow.last90DayTransactionValue),
      last90DayTransactionVolume: Math.trunc(toNumber(kpiRow.last90DayTransactionVolume)),
      averageTransactionValue: selectedPeriodTransactionVolume === 0 ? 0 : selectedPeriodTransactionValue / selectedPeriodTransactionVolume,
    },
    dailyTrend: (resTrend.recordset as Array<Record<string, unknown>>).map((row) => ({
      period: String(row.period),
      transactionValue: toNumber(row.transactionValue),
      transactionVolume: Math.trunc(toNumber(row.transactionVolume)),
      commission: toNumber(row.commission),
      depositValue: toNumber(row.depositValue),
      withdrawalValue: toNumber(row.withdrawalValue),
    })),
  };
}

// ─── KPI Aggregate (for overview) ────────────────────────────────────────────

async function computeKpis(params: {
  currency: Currency;
  dateFrom: Date;
  dateTo: Date;
  asOfDate: Date;
}): Promise<WalletKpis> {
  const [transactionKpis, customerKpis, eFloatKpis] = await Promise.all([
    queryTransactionKpis(params),
    queryCustomerKpis(params),
    queryEFloatWithFallback({ currency: params.currency, asOfDate: params.asOfDate }),
  ]);

  return { ...transactionKpis, ...customerKpis, ...eFloatKpis };
}

// ─── Insight Alerts ───────────────────────────────────────────────────────────

function addInsightAlert(alerts: WalletInsightAlertItem[], alert: WalletInsightAlertItem): void {
  alerts.push(alert);
}

function summarizeInsightAlerts(alerts: WalletInsightAlertItem[]): WalletInsightsAlertsResponse["summary"] {
  return {
    criticalCount: alerts.filter((a) => a.severity === "critical").length,
    warningCount: alerts.filter((a) => a.severity === "warning").length,
    positiveCount: alerts.filter((a) => a.severity === "positive").length,
    infoCount: alerts.filter((a) => a.severity === "info").length,
    totalAlerts: alerts.length,
  };
}

// ─── Exported Service Functions ───────────────────────────────────────────────

export async function getWalletOverview(
  input: WalletOverviewInput,
): Promise<WalletOverviewResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const currency = input.currency;
  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);
  const asOfDate = normalizeDateOnly(input.asOfDate);
  const daySpan = Math.max(1, Math.floor((dateTo.getTime() - dateFrom.getTime()) / 86_400_000) + 1);
  const previousDateTo = addDays(dateFrom, -1);
  const previousDateFrom = addDays(previousDateTo, -(daySpan - 1));

  const kpis = await computeKpis({ currency, dateFrom, dateTo, asOfDate });

  let comparison: WalletOverviewResponse["comparison"] = null;
  if (input.compare) {
    const previousKpis = await computeKpis({
      currency,
      dateFrom: previousDateFrom,
      dateTo: previousDateTo,
      asOfDate: previousDateTo,
    });

    comparison = {
      previousPeriodDateFrom: formatDate(previousDateFrom),
      previousPeriodDateTo: formatDate(previousDateTo),
      kpis: {
        totalTransactionValue: buildComparisonKpi(kpis.totalTransactionValue, previousKpis.totalTransactionValue),
        totalTransactionVolume: buildComparisonKpi(kpis.totalTransactionVolume, previousKpis.totalTransactionVolume),
        totalCommission: buildComparisonKpi(kpis.totalCommission, previousKpis.totalCommission),
        activeCustomersA30: buildComparisonKpi(kpis.activeCustomersA30, previousKpis.activeCustomersA30),
        activeCustomersA60: buildComparisonKpi(kpis.activeCustomersA60, previousKpis.activeCustomersA60),
        newCustomers: buildComparisonKpi(kpis.newCustomers, previousKpis.newCustomers),
        dormantCustomers90Plus:
          kpis.dormantCustomers90Plus === null || previousKpis.dormantCustomers90Plus === null
            ? null
            : buildComparisonKpi(kpis.dormantCustomers90Plus, previousKpis.dormantCustomers90Plus),
        latestTotalEFloat: buildComparisonKpi(kpis.latestTotalEFloat, previousKpis.latestTotalEFloat),
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
      currency,
      dataFreshnessTimestamp: new Date().toISOString(),
      sourceSummaryTable: env.SOURCE_SQL_TRANSACTIONS_TABLE,
      sourceBalanceTable: getBalanceHistoryTable(currency).schema + "." + getBalanceHistoryTable(currency).table,
      sourceBalanceCurrentTable: getBalanceCurrentTable(currency).schema + "." + getBalanceCurrentTable(currency).table,
    },
  };
}

export async function getWalletCustomerActivityGrowth(
  input: WalletCustomerActivityGrowthInput,
): Promise<WalletCustomerActivityGrowthResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const currency = input.currency;
  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);

  const [dailyTrendRaw, monthlyTrendRaw, frequencyBuckets] = await Promise.all([
    queryActivityTrend({ currency, dateFrom, dateTo, grain: "daily" }),
    queryActivityTrend({ currency, dateFrom, dateTo, grain: "monthly" }),
    queryFrequencyBuckets({ currency, dateFrom, dateTo }),
  ]);

  const dailyTrend = dailyTrendRaw.map((row) => ({
    period: row.period,
    activeCustomers: row.activeCustomers,
    newCustomers: row.newCustomers,
    returningCustomers: Math.max(0, row.activeCustomers - row.newCustomers),
    transactionVolume: row.transactionVolume,
  }));
  const monthlyTrend = monthlyTrendRaw.map((row) => ({
    period: row.period,
    activeCustomers: row.activeCustomers,
    newCustomers: row.newCustomers,
    returningCustomers: Math.max(0, row.activeCustomers - row.newCustomers),
    transactionVolume: row.transactionVolume,
  }));

  const totalActiveCustomers = frequencyBuckets.reduce((sum, b) => sum + b.customers, 0);
  const newCustomers = dailyTrend.reduce((sum, p) => sum + p.newCustomers, 0);
  const transactionVolume = dailyTrend.reduce((sum, p) => sum + p.transactionVolume, 0);

  return {
    period: { dateFrom: formatDate(dateFrom), dateTo: formatDate(dateTo) },
    kpis: {
      activeCustomers: totalActiveCustomers,
      newCustomers,
      returningCustomers: Math.max(0, totalActiveCustomers - newCustomers),
      transactionVolume,
      averageTransactionsPerActiveCustomer: totalActiveCustomers === 0 ? 0 : transactionVolume / totalActiveCustomers,
    },
    dailyTrend,
    monthlyTrend,
    frequencyBuckets,
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
      sourceSummaryTable: env.SOURCE_SQL_TRANSACTIONS_TABLE,
    },
  };
}

export async function getWalletRetentionDormancy(
  input: WalletRetentionDormancyInput,
): Promise<WalletRetentionDormancyResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const currency = input.currency;
  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);
  const asOfDate = normalizeDateOnly(input.asOfDate);

  const retention = await queryRetentionDormancy({ currency, dateFrom, dateTo, asOfDate });
  const reactivatedCustomers = retention.reactivationTrend.reduce((sum, p) => sum + p.reactivatedCustomers, 0);

  return {
    period: {
      dateFrom: formatDate(dateFrom),
      dateTo: formatDate(dateTo),
      asOfDate: formatDate(asOfDate),
    },
    kpis: {
      activeCustomersA30: retention.activeCustomersA30,
      dormantCustomers90Plus: retention.dormantCustomers90Plus,
      dormancyRate: retention.totalCustomers === 0 ? 0 : (retention.dormantCustomers90Plus / retention.totalCustomers) * 100,
      reactivatedCustomers,
    },
    inactivityBuckets: retention.inactivityBuckets,
    reactivationTrend: retention.reactivationTrend,
    cohorts: retention.cohorts,
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
    },
  };
}

export async function getWalletTransactionPerformance(
  input: WalletTransactionPerformanceInput,
): Promise<WalletTransactionPerformanceResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const currency = input.currency;
  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);

  const [kpis, dailyTrend, monthlyTrend] = await Promise.all([
    queryTransactionPerformanceKpis({ currency, dateFrom, dateTo }),
    queryTransactionPerformanceTrend({ currency, dateFrom, dateTo, grain: "daily" }),
    queryTransactionPerformanceTrend({ currency, dateFrom, dateTo, grain: "monthly" }),
  ]);

  return {
    period: { dateFrom: formatDate(dateFrom), dateTo: formatDate(dateTo) },
    kpis,
    dailyTrend,
    monthlyTrend,
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
      sourceSummaryTable: env.SOURCE_SQL_TRANSACTIONS_TABLE,
    },
  };
}

export async function getWalletRevenuePerformance(
  input: WalletRevenuePerformanceInput,
): Promise<WalletRevenuePerformanceResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const currency = input.currency;
  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);

  const [kpis, dailyTrend, monthlyTrend] = await Promise.all([
    queryRevenuePerformanceKpis({ currency, dateFrom, dateTo }),
    queryRevenuePerformanceTrend({ currency, dateFrom, dateTo, grain: "daily" }),
    queryRevenuePerformanceTrend({ currency, dateFrom, dateTo, grain: "monthly" }),
  ]);

  return {
    period: { dateFrom: formatDate(dateFrom), dateTo: formatDate(dateTo) },
    kpis,
    dailyTrend,
    monthlyTrend,
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
      sourceSummaryTable: env.SOURCE_SQL_TRANSACTIONS_TABLE,
    },
  };
}

export async function getWalletLiquidity(
  input: WalletLiquidityInput,
): Promise<WalletLiquidityResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const currency = input.currency;
  const balanceCurrentTable = getBalanceCurrentTable(currency);
  const balanceHistoryTable = getBalanceHistoryTable(currency);
  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);
  const asOfDate = normalizeDateOnly(input.asOfDate);

  const [kpis, dailyTrend, productBreakdown] = await Promise.all([
    queryLiquiditySnapshot({ table: balanceCurrentTable, asOfDate }),
    queryLiquidityTrend({ table: balanceHistoryTable, dateFrom, dateTo }),
    queryLiquidityProductBreakdown({ table: balanceCurrentTable, asOfDate }),
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
      sourceBalanceCurrentTable: `${balanceCurrentTable.schema}.${balanceCurrentTable.table}`,
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

  const { items, total } = await queryCustomer360List({
    currency: input.currency,
    search: input.search,
    status: input.status ?? "all",
    asOfDate,
    page,
    pageSize,
  });

  return {
    items: items.map((row) => mapCustomer360Summary(row, asOfDate)),
    page,
    pageSize,
    total,
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
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

  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);
  const asOfDate = normalizeDateOnly(input.asOfDate);

  const { customer, kpis, dailyTrend } = await queryCustomer360Detail({
    currency: input.currency,
    customerId,
    dateFrom,
    dateTo,
    asOfDate,
  });

  if (!customer) {
    throw new WalletServiceError("Customer not found", 404);
  }

  return {
    customer: mapCustomer360Summary(customer, asOfDate),
    kpis,
    dailyTrend,
    metadata: {
      dataFreshnessTimestamp: new Date().toISOString(),
      sourceSummaryTable: env.SOURCE_SQL_TRANSACTIONS_TABLE,
    },
  };
}

export async function getWalletInsightsAlerts(
  input: WalletInsightsAlertsInput,
): Promise<WalletInsightsAlertsResponse> {
  if (input.dateFrom > input.dateTo) {
    throw new WalletServiceError("dateFrom must be less than or equal to dateTo", 400);
  }

  const currency = input.currency;
  const dateFrom = normalizeDateOnly(input.dateFrom);
  const dateTo = normalizeDateOnly(input.dateTo);
  const asOfDate = normalizeDateOnly(input.asOfDate);

  const [overview, transactionPerformance, revenuePerformance, liquidity] = await Promise.all([
    getWalletOverview({ dateFrom, dateTo, asOfDate, compare: true, currency }),
    getWalletTransactionPerformance({ dateFrom, dateTo, currency }),
    getWalletRevenuePerformance({ dateFrom, dateTo, currency }),
    getWalletLiquidity({ dateFrom, dateTo, asOfDate, currency }),
  ]);

  const alerts: WalletInsightAlertItem[] = [];
  const transactionValueChange = overview.comparison?.kpis.totalTransactionValue.percentChange ?? null;
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
      metricLabel: "Active customers change",
      metricValue: activeA30Change,
      thresholdLabel: "Below -8%",
      message: "The number of customers active in the last 30 days fell against the prior period.",
      suggestedAction: "Investigate if there is a specific customer segment or product driving the decline.",
    });
  } else if (activeA30Change !== null && activeA30Change >= 8) {
    addInsightAlert(alerts, {
      id: "activity-a30-up",
      severity: "positive",
      category: "activity",
      title: "Active customers A30 are growing",
      metricLabel: "Active customers change",
      metricValue: activeA30Change,
      thresholdLabel: "Above +8%",
      message: "More customers are transacting compared to the prior period.",
      suggestedAction: "Ensure liquidity keeps pace with the increased activity.",
    });
  }

  if (dormantChange !== null && dormantChange >= 10) {
    addInsightAlert(alerts, {
      id: "dormancy-up",
      severity: dormantChange >= 20 ? "critical" : "warning",
      category: "dormancy",
      title: "Dormant customers are increasing",
      metricLabel: "Dormant change",
      metricValue: dormantChange,
      thresholdLabel: "Above +10%",
      message: "The pool of customers inactive for 90+ days has grown since the prior period.",
      suggestedAction: "Run a reactivation campaign targeting dormant customers with relevant incentives.",
    });
  }

  if (commissionRate < 0.5 && revenuePerformance.kpis.totalTransactionVolume > 0) {
    addInsightAlert(alerts, {
      id: "revenue-commission-rate-low",
      severity: "warning",
      category: "revenue",
      title: "Commission rate is below 0.5%",
      metricLabel: "Commission rate",
      metricValue: commissionRate,
      thresholdLabel: "Below 0.5%",
      message: "The commission rate on wallet transactions is low relative to typical expectations.",
      suggestedAction: "Review fee structures and check if commission-free transaction types are growing.",
    });
  }

  if (netFlowValue < 0) {
    addInsightAlert(alerts, {
      id: "cash-flow-negative",
      severity: Math.abs(netFlowValue) > 100_000 ? "critical" : "warning",
      category: "cash_flow",
      title: "Net cash flow is negative",
      metricLabel: "Net flow",
      metricValue: netFlowValue,
      thresholdLabel: "Below 0",
      message: "Withdrawals exceeded deposits in the selected period, resulting in net outflow.",
      suggestedAction: "Monitor e-float levels and ensure sufficient liquidity to meet customer demand.",
    });
  }

  if (lowBalanceShare > 30) {
    addInsightAlert(alerts, {
      id: "liquidity-low-balance",
      severity: lowBalanceShare > 60 ? "critical" : "warning",
      category: "liquidity",
      title: "High share of low-balance accounts",
      metricLabel: "Low-balance share",
      metricValue: lowBalanceShare,
      thresholdLabel: `Above 30% (threshold ${LOW_BALANCE_THRESHOLD})`,
      message: `More than ${Math.round(lowBalanceShare)}% of accounts have a balance below ${LOW_BALANCE_THRESHOLD}.`,
      suggestedAction: "Encourage minimum balance deposits or review e-float distribution strategy.",
    });
  }

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
      sourceSummaryTable: env.SOURCE_SQL_TRANSACTIONS_TABLE,
      sourceBalanceCurrentTable: `${getBalanceCurrentTable(currency).schema}.${getBalanceCurrentTable(currency).table}`,
    },
  };
}
