import sql from "mssql";

import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { getSourcePool, isSourceDbConfigured } from "../db/source-db";

export class WalletSnapshotSyncError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "WalletSnapshotSyncError";
  }
}

export type WalletSnapshotSyncResult = {
  customerCount: number;
  durationMs: number;
  refreshedAt: string;
};

type SnapshotRow = {
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

const BATCH_SIZE = 500;

function parseTable(value: string): { schema: string; table: string } {
  const [schema, table] = value.split(".");
  return { schema, table };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "bigint") return Number(value);
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  return new Date(String(value));
}

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

async function fetchSnapshotRowsFromSource(): Promise<SnapshotRow[]> {
  const pool = await getSourcePool();
  const tx = parseTable(env.SOURCE_SQL_TRANSACTIONS_TABLE);
  const acct = parseTable(env.SOURCE_SQL_USD_ACCOUNTS_TABLE);
  const cust = parseTable(env.SOURCE_SQL_CUSTOMER_TABLE);

  const asOfDate = new Date();
  const last30 = new Date(asOfDate.getTime() - 29 * 86_400_000);
  const last60 = new Date(asOfDate.getTime() - 59 * 86_400_000);

  const request = pool.request();
  request.input("currency", sql.NVarChar(10), "USD");
  request.input("last30", sql.Date, last30);
  request.input("last60", sql.Date, last60);

  const result = await request.query(`
    WITH customer_tx AS (
      SELECT
        a.[CIF],
        MIN(CAST(t.[Date] AS DATE))                                                AS firstSeenDate,
        MAX(CAST(t.[Date] AS DATE))                                                AS lastSeenDate,
        COALESCE(SUM(t.[TransactionAmount]), 0)                                    AS lifetimeTransactionValue,
        COALESCE(SUM(CAST(t.[Volume] AS BIGINT)), 0)                               AS lifetimeTransactionVolume,
        COALESCE(ABS(SUM(CASE WHEN t.[NetFee] < 0 THEN t.[NetFee] ELSE 0 END)), 0) AS lifetimeCommission,
        COALESCE(SUM(CASE WHEN t.[Date] >= @last30 THEN t.[TransactionAmount] ELSE 0 END), 0) AS last30DayTransactionValue,
        COALESCE(SUM(CASE WHEN t.[Date] >= @last60 THEN t.[TransactionAmount] ELSE 0 END), 0) AS last60DayTransactionValue,
        COUNT(*)                                                                   AS sourceRowCount
      FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
      JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
      WHERE t.[Currency] = @currency AND a.[CIF] IS NOT NULL
      GROUP BY a.[CIF]
    ),
    customer_info AS (
      SELECT
        [CIF],
        MAX(LTRIM(RTRIM(CAST([FirstName] AS VARCHAR(255))))) AS firstName,
        MAX(LTRIM(RTRIM(CAST([LastName]  AS VARCHAR(255))))) AS lastName,
        MAX(LTRIM(RTRIM(CAST([MobileNumber] AS VARCHAR(120))))) AS mobileNumber
      FROM [${cust.schema}].[${cust.table}] WITH (NOLOCK)
      GROUP BY [CIF]
    )
    SELECT
      ctx.[CIF]                                                                     AS customerId,
      NULLIF(LTRIM(RTRIM(CONCAT(ci.firstName, ' ', ci.lastName))), ' ')            AS fullName,
      NULLIF(ci.mobileNumber, '')                                                   AS mobileNumber,
      ctx.firstSeenDate,
      ctx.lastSeenDate,
      ctx.lifetimeTransactionValue,
      ctx.lifetimeTransactionVolume,
      ctx.lifetimeCommission,
      ctx.last30DayTransactionValue,
      ctx.last60DayTransactionValue,
      ctx.sourceRowCount
    FROM customer_tx ctx
    LEFT JOIN customer_info ci ON ctx.[CIF] = ci.[CIF]
  `);

  return (result.recordset as Array<Record<string, unknown>>).map((row) => ({
    customerId: String(row.customerId),
    fullName: normalizeString(row.fullName),
    mobileNumber: normalizeString(row.mobileNumber),
    firstSeenDate: toDate(row.firstSeenDate),
    lastSeenDate: toDate(row.lastSeenDate),
    lifetimeTransactionValue: toNumber(row.lifetimeTransactionValue),
    lifetimeTransactionVolume: toNumber(row.lifetimeTransactionVolume),
    lifetimeCommission: toNumber(row.lifetimeCommission),
    last30DayTransactionValue: toNumber(row.last30DayTransactionValue),
    last60DayTransactionValue: toNumber(row.last60DayTransactionValue),
    sourceRowCount: Math.trunc(toNumber(row.sourceRowCount)),
  }));
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function syncWalletCustomerSnapshot(): Promise<WalletSnapshotSyncResult> {
  if (!isSourceDbConfigured()) {
    throw new WalletSnapshotSyncError("Source SQL connection is not configured.", 503);
  }

  const startMs = Date.now();
  const refreshedAt = new Date();

  console.log("[WalletSnapshot] Fetching customer aggregates from source DB...");
  const rows = await fetchSnapshotRowsFromSource();
  console.log(`[WalletSnapshot] Fetched ${rows.length} customer records from source DB.`);

  // Full refresh: clear and re-populate
  await prisma.walletCustomerActivitySnapshot.deleteMany({});
  console.log("[WalletSnapshot] Cleared existing snapshot. Inserting new records...");

  const batches = chunkArray(rows, BATCH_SIZE);
  for (let i = 0; i < batches.length; i++) {
    await prisma.walletCustomerActivitySnapshot.createMany({
      data: batches[i].map((row) => ({
        customerId: row.customerId,
        fullName: row.fullName,
        mobileNumber: row.mobileNumber,
        firstSeenDate: row.firstSeenDate,
        lastSeenDate: row.lastSeenDate,
        lifetimeTransactionValue: row.lifetimeTransactionValue,
        lifetimeTransactionVolume: row.lifetimeTransactionVolume,
        lifetimeCommission: row.lifetimeCommission,
        last30DayTransactionValue: row.last30DayTransactionValue,
        last60DayTransactionValue: row.last60DayTransactionValue,
        sourceRowCount: row.sourceRowCount,
        refreshedAt,
      })),
    });

    if ((i + 1) % 100 === 0 || i === batches.length - 1) {
      console.log(`[WalletSnapshot] Inserted batch ${i + 1}/${batches.length} (${Math.min((i + 1) * BATCH_SIZE, rows.length)}/${rows.length} records)`);
    }
  }

  return {
    customerCount: rows.length,
    durationMs: Date.now() - startMs,
    refreshedAt: refreshedAt.toISOString(),
  };
}

export async function getSnapshotStatus(): Promise<{
  customerCount: number;
  refreshedAt: string | null;
  isStale: boolean;
}> {
  const [count, latest] = await Promise.all([
    prisma.walletCustomerActivitySnapshot.count(),
    prisma.walletCustomerActivitySnapshot.findFirst({
      orderBy: { refreshedAt: "desc" },
      select: { refreshedAt: true },
    }),
  ]);

  const refreshedAt = latest?.refreshedAt ?? null;
  const staleCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days
  const isStale = count === 0 || (refreshedAt !== null && refreshedAt < staleCutoff);

  return {
    customerCount: count,
    refreshedAt: refreshedAt?.toISOString() ?? null,
    isStale,
  };
}
