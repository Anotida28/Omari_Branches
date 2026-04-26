import { Prisma } from "@prisma/client";
import sql from "mssql";

import { env } from "../config/env";
import { prisma } from "../db/prisma";

type QualifiedTableName = {
  schema: string;
  table: string;
};

type SourceCustomerActivityRow = {
  customerId: string;
  fullName: string | null;
  mobileNumber: string | null;
  firstSeenDate: Date;
  lastSeenDate: Date;
  lifetimeTransactionValue: number;
  lifetimeTransactionVolume: number;
  lifetimeCommission: number;
  last30DayTransactionValue: number;
  last60DayTransactionValue: number;
  sourceRowCount: number;
};

export type WalletCustomerActivitySyncResult = {
  asOfDate: string;
  sourceCustomerCount: number;
  refreshedCustomerCount: number;
  refreshedAt: string;
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function parseQualifiedTableName(value: string): QualifiedTableName {
  const [schema, table] = value.split(".");
  return { schema, table };
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
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

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
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

async function getPool(): Promise<sql.ConnectionPool> {
  if (
    !env.SOURCE_SQL_SERVER ||
    !env.SOURCE_SQL_DATABASE ||
    !env.SOURCE_SQL_USER ||
    !env.SOURCE_SQL_PASSWORD
  ) {
    throw new Error("Source SQL metrics connection is not configured.");
  }

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

async function fetchSourceCustomerActivityRows(
  asOfDate: Date,
): Promise<SourceCustomerActivityRow[]> {
  const pool = await getPool();
  const table = parseQualifiedTableName(env.SOURCE_SQL_AGENT_SUMMARY_TABLE);
  const request = pool.request();
  request.input("asOfDate", sql.Date, asOfDate);
  request.input("a30Date", sql.Date, addDays(asOfDate, -29));
  request.input("a60Date", sql.Date, addDays(asOfDate, -59));

  const result = await request.query(`
    SELECT
      LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) AS customerId,
      MAX(NULLIF(LTRIM(RTRIM(CAST([full_name] AS VARCHAR(255)))), '')) AS fullName,
      MAX(NULLIF(LTRIM(RTRIM(CAST([mobile_number] AS VARCHAR(120)))), '')) AS mobileNumber,
      MIN(CAST([date_id] AS DATE)) AS firstSeenDate,
      MAX(CAST([date_id] AS DATE)) AS lastSeenDate,
      COALESCE(SUM(COALESCE([total_value], 0)), 0) AS lifetimeTransactionValue,
      COALESCE(SUM(COALESCE([total_volume], 0)), 0) AS lifetimeTransactionVolume,
      COALESCE(SUM(COALESCE([total_commission], 0)), 0) AS lifetimeCommission,
      COALESCE(SUM(CASE WHEN [date_id] >= @a30Date THEN COALESCE([total_value], 0) ELSE 0 END), 0) AS last30DayTransactionValue,
      COALESCE(SUM(CASE WHEN [date_id] >= @a60Date THEN COALESCE([total_value], 0) ELSE 0 END), 0) AS last60DayTransactionValue,
      COUNT_BIG(*) AS sourceRowCount
    FROM [${table.schema}].[${table.table}] WITH (NOLOCK)
    WHERE [date_id] <= @asOfDate
      AND [customer_id] IS NOT NULL
      AND LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))) <> ''
    GROUP BY LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120))))
  `);

  return (result.recordset as Array<Record<string, unknown>>)
    .map((row) => ({
      customerId: String(row.customerId).trim(),
      fullName: normalizeString(row.fullName),
      mobileNumber: normalizeString(row.mobileNumber),
      firstSeenDate: row.firstSeenDate as Date,
      lastSeenDate: row.lastSeenDate as Date,
      lifetimeTransactionValue: toNumber(row.lifetimeTransactionValue),
      lifetimeTransactionVolume: Math.trunc(toNumber(row.lifetimeTransactionVolume)),
      lifetimeCommission: toNumber(row.lifetimeCommission),
      last30DayTransactionValue: toNumber(row.last30DayTransactionValue),
      last60DayTransactionValue: toNumber(row.last60DayTransactionValue),
      sourceRowCount: Math.trunc(toNumber(row.sourceRowCount)),
    }))
    .filter((row) => row.customerId.length > 0);
}

function chunkValues<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

async function upsertCustomerActivityBatch(
  rows: SourceCustomerActivityRow[],
  refreshedAt: Date,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const values = rows.map((row) => Prisma.sql`(
    CAST(${row.customerId} AS VARCHAR(120)),
    CAST(${row.fullName} AS VARCHAR(255)),
    CAST(${row.mobileNumber} AS VARCHAR(120)),
    CAST(${row.firstSeenDate} AS DATE),
    CAST(${row.lastSeenDate} AS DATE),
    CAST(${row.lifetimeTransactionValue} AS DECIMAL(18,2)),
    CAST(${row.lifetimeTransactionVolume} AS INT),
    CAST(${row.lifetimeCommission} AS DECIMAL(18,2)),
    CAST(${row.last30DayTransactionValue} AS DECIMAL(18,2)),
    CAST(${row.last60DayTransactionValue} AS DECIMAL(18,2)),
    CAST(${row.sourceRowCount} AS INT),
    CAST(${refreshedAt} AS DATETIME2),
    CAST(${refreshedAt} AS DATETIME2)
  )`);

  await prisma.$executeRaw`
    MERGE [WalletCustomerActivitySnapshot] AS target
    USING (
      VALUES ${Prisma.join(values)}
    ) AS source (
      [customerId],
      [fullName],
      [mobileNumber],
      [firstSeenDate],
      [lastSeenDate],
      [lifetimeTransactionValue],
      [lifetimeTransactionVolume],
      [lifetimeCommission],
      [last30DayTransactionValue],
      [last60DayTransactionValue],
      [sourceRowCount],
      [refreshedAt],
      [updatedAt]
    )
      ON target.[customerId] = source.[customerId]
    WHEN MATCHED THEN
      UPDATE SET
        [fullName] = source.[fullName],
        [mobileNumber] = source.[mobileNumber],
        [firstSeenDate] = source.[firstSeenDate],
        [lastSeenDate] = source.[lastSeenDate],
        [lifetimeTransactionValue] = source.[lifetimeTransactionValue],
        [lifetimeTransactionVolume] = source.[lifetimeTransactionVolume],
        [lifetimeCommission] = source.[lifetimeCommission],
        [last30DayTransactionValue] = source.[last30DayTransactionValue],
        [last60DayTransactionValue] = source.[last60DayTransactionValue],
        [sourceRowCount] = source.[sourceRowCount],
        [refreshedAt] = source.[refreshedAt],
        [updatedAt] = source.[updatedAt]
    WHEN NOT MATCHED THEN
      INSERT (
        [customerId],
        [fullName],
        [mobileNumber],
        [firstSeenDate],
        [lastSeenDate],
        [lifetimeTransactionValue],
        [lifetimeTransactionVolume],
        [lifetimeCommission],
        [last30DayTransactionValue],
        [last60DayTransactionValue],
        [sourceRowCount],
        [refreshedAt],
        [createdAt],
        [updatedAt]
      )
      VALUES (
        source.[customerId],
        source.[fullName],
        source.[mobileNumber],
        source.[firstSeenDate],
        source.[lastSeenDate],
        source.[lifetimeTransactionValue],
        source.[lifetimeTransactionVolume],
        source.[lifetimeCommission],
        source.[last30DayTransactionValue],
        source.[last60DayTransactionValue],
        source.[sourceRowCount],
        source.[refreshedAt],
        source.[updatedAt],
        source.[updatedAt]
      );
  `;
}

export async function syncWalletCustomerActivitySnapshot(
  asOfDateInput: Date = new Date(),
): Promise<WalletCustomerActivitySyncResult> {
  const asOfDate = normalizeDateOnly(asOfDateInput);
  const refreshedAt = new Date();
  const rows = await fetchSourceCustomerActivityRows(asOfDate);

  for (const batch of chunkValues(rows, 100)) {
    await upsertCustomerActivityBatch(batch, refreshedAt);
  }

  return {
    asOfDate: formatDate(asOfDate),
    sourceCustomerCount: rows.length,
    refreshedCustomerCount: rows.length,
    refreshedAt: refreshedAt.toISOString(),
  };
}
