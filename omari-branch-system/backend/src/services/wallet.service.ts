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

type NumericRecord = Record<string, unknown>;

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
        dormantCustomers90Plus: null,
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
