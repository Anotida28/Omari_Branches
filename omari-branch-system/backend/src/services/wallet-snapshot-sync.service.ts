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
  mode: "full" | "incremental";
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

/**
 * Fetch customer snapshot rows from the source DB.
 *
 * Full mode (sinceDate = undefined): returns all customers with any USD transaction.
 * Incremental mode (sinceDate provided): returns only customers who had at least one
 * transaction on or after sinceDate, but computes their FULL lifetime aggregates so the
 * stored record is always accurate.
 */
async function fetchSnapshotRowsFromSource(sinceDate?: Date): Promise<SnapshotRow[]> {
  const pool = await getSourcePool();
  const tx = parseTable(env.SOURCE_SQL_TRANSACTIONS_TABLE);
  const acct = parseTable(env.SOURCE_SQL_USD_ACCOUNTS_TABLE);
  const cust = parseTable(env.SOURCE_SQL_CUSTOMER_TABLE);
  const agentT = parseTable(env.SOURCE_SQL_AGENT_SUMMARY_TABLE);

  const asOfDate = new Date();
  const last30 = new Date(asOfDate.getTime() - 29 * 86_400_000);
  const last60 = new Date(asOfDate.getTime() - 59 * 86_400_000);

  const request = pool.request();
  request.input("currency", sql.NVarChar(10), "USD");
  request.input("last30", sql.Date, last30);
  request.input("last60", sql.Date, last60);

  const agentCifCte = `
    agent_cifs AS (
      SELECT DISTINCT LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(50)))) AS cif
      FROM [${agentT.schema}].[${agentT.table}] WITH (NOLOCK)
      WHERE [customer_id] IS NOT NULL
        AND LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(50)))) != ''
    )`;

  // Build the query — incremental mode adds an active_cifs CTE to restrict which customers
  // we process, while still aggregating their full transaction history.
  let query: string;

  if (sinceDate) {
    request.input("sinceDate", sql.Date, sinceDate);
    query = `
      WITH active_cifs AS (
        SELECT DISTINCT a.[CIF]
        FROM [${tx.schema}].[${tx.table}] t WITH (NOLOCK)
        JOIN [${acct.schema}].[${acct.table}] a WITH (NOLOCK) ON t.[AccountId] = a.[AccountId]
        WHERE t.[Date] >= @sinceDate AND t.[Currency] = @currency AND a.[CIF] IS NOT NULL
      ),
      ${agentCifCte},
      customer_tx AS (
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
        JOIN active_cifs ac ON a.[CIF] = ac.[CIF]
        WHERE t.[Currency] = @currency AND a.[CIF] IS NOT NULL
        GROUP BY a.[CIF]
      ),
      customer_info AS (
        SELECT
          c.[CIF],
          MAX(LTRIM(RTRIM(CAST(c.[FirstName] AS VARCHAR(255))))) AS firstName,
          MAX(LTRIM(RTRIM(CAST(c.[LastName]  AS VARCHAR(255))))) AS lastName,
          MAX(LTRIM(RTRIM(CAST(c.[MobileNumber] AS VARCHAR(120))))) AS mobileNumber
        FROM [${cust.schema}].[${cust.table}] c WITH (NOLOCK)
        JOIN active_cifs ac ON c.[CIF] = ac.[CIF]
        GROUP BY c.[CIF]
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
      LEFT JOIN agent_cifs ag ON ctx.[CIF] = ag.cif
      WHERE ag.cif IS NULL
    `;
  } else {
    query = `
      WITH ${agentCifCte},
      customer_tx AS (
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
      LEFT JOIN agent_cifs ag ON ctx.[CIF] = ag.cif
      WHERE ag.cif IS NULL
    `;
  }

  const result = await request.query(query);

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

async function getLastRefreshedAt(): Promise<Date | null> {
  const latest = await prisma.walletCustomerActivitySnapshot.findFirst({
    orderBy: { refreshedAt: "desc" },
    select: { refreshedAt: true },
  });
  return latest?.refreshedAt ?? null;
}

/**
 * Run a full sync: clears the entire table and re-populates from source.
 * Used on first run and on the weekly Sunday reset.
 */
async function runFullSync(refreshedAt: Date): Promise<number> {
  console.log("[WalletSnapshot] Running FULL sync — fetching all customer aggregates from source DB...");
  const rows = await fetchSnapshotRowsFromSource();
  console.log(`[WalletSnapshot] Fetched ${rows.length} customer records.`);

  await prisma.walletCustomerActivitySnapshot.deleteMany({});
  console.log("[WalletSnapshot] Cleared existing snapshot. Inserting records...");

  const batches = chunkArray(rows, BATCH_SIZE);
  for (let i = 0; i < batches.length; i++) {
    await prisma.walletCustomerActivitySnapshot.createMany({
      data: batches[i].map((row) => ({
        ...row,
        refreshedAt,
      })),
    });

    if ((i + 1) % 100 === 0 || i === batches.length - 1) {
      console.log(`[WalletSnapshot] Inserted batch ${i + 1}/${batches.length} (${Math.min((i + 1) * BATCH_SIZE, rows.length)}/${rows.length} records)`);
    }
  }

  return rows.length;
}

/**
 * Fetch distinct agent CIFs from source DB, then delete any matching snapshot records.
 * Called after every incremental sync to remove agents that may already be in the table.
 */
async function purgeAgentsFromSnapshot(): Promise<number> {
  const pool = await getSourcePool();
  const agentT = parseTable(env.SOURCE_SQL_AGENT_SUMMARY_TABLE);
  const result = await pool.request().query(`
    SELECT DISTINCT LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(50)))) AS cif
    FROM [${agentT.schema}].[${agentT.table}] WITH (NOLOCK)
    WHERE [customer_id] IS NOT NULL
      AND LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(50)))) != ''
  `);
  const agentCifs = (result.recordset as Array<{ cif: string }>).map((r) => r.cif);
  if (agentCifs.length === 0) return 0;
  const { count } = await prisma.walletCustomerActivitySnapshot.deleteMany({
    where: { customerId: { in: agentCifs } },
  });
  if (count > 0) {
    console.log(`[WalletSnapshot] Purged ${count} agent record(s) from snapshot.`);
  }
  return count;
}

/**
 * Run an incremental sync: fetches only customers active since sinceDate, then upserts
 * their records. Inactive customers are left untouched.
 */
async function runIncrementalSync(sinceDate: Date, refreshedAt: Date): Promise<number> {
  console.log(`[WalletSnapshot] Running INCREMENTAL sync — fetching customers active since ${sinceDate.toISOString()}...`);
  const rows = await fetchSnapshotRowsFromSource(sinceDate);
  console.log(`[WalletSnapshot] Fetched ${rows.length} changed customer records.`);

  if (rows.length === 0) {
    return 0;
  }

  const batches = chunkArray(rows, BATCH_SIZE);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const ids = batch.map((r) => r.customerId);

    // Delete existing records for this batch of customers then reinsert with fresh data.
    await prisma.$transaction([
      prisma.walletCustomerActivitySnapshot.deleteMany({
        where: { customerId: { in: ids } },
      }),
      prisma.walletCustomerActivitySnapshot.createMany({
        data: batch.map((row) => ({
          ...row,
          refreshedAt,
        })),
      }),
    ]);

    if ((i + 1) % 20 === 0 || i === batches.length - 1) {
      console.log(`[WalletSnapshot] Upserted batch ${i + 1}/${batches.length} (${Math.min((i + 1) * BATCH_SIZE, rows.length)}/${rows.length} records)`);
    }
  }

  return rows.length;
}

/**
 * Sync the wallet customer snapshot.
 *
 * - full: always clears and re-populates the entire table (used for the weekly Sunday job).
 * - incremental (default): if a previous snapshot exists and is recent, only processes
 *   customers who have been active since the last sync minus a 1-day buffer. Falls back to
 *   a full sync if there is no existing data.
 */
export async function syncWalletCustomerSnapshot(mode: "full" | "incremental" = "incremental"): Promise<WalletSnapshotSyncResult> {
  if (!isSourceDbConfigured()) {
    throw new WalletSnapshotSyncError("Source SQL connection is not configured.", 503);
  }

  const startMs = Date.now();
  const refreshedAt = new Date();

  let customerCount: number;
  let effectiveMode: "full" | "incremental";

  if (mode === "full") {
    customerCount = await runFullSync(refreshedAt);
    effectiveMode = "full";
  } else {
    const lastRefreshedAt = await getLastRefreshedAt();

    if (!lastRefreshedAt) {
      // No existing data — must do a full sync first.
      console.log("[WalletSnapshot] No existing snapshot found — falling back to full sync.");
      customerCount = await runFullSync(refreshedAt);
      effectiveMode = "full";
    } else {
      // Subtract 1 day from the last sync time as a buffer so we don't miss transactions
      // that landed close to the sync boundary.
      const sinceDate = new Date(lastRefreshedAt.getTime() - 86_400_000);
      customerCount = await runIncrementalSync(sinceDate, refreshedAt);
      effectiveMode = "incremental";
    }
  }

  // Always purge any agents that ended up in the snapshot (guards the incremental path).
  await purgeAgentsFromSnapshot();

  console.log(`[WalletSnapshot] ${effectiveMode} sync complete — ${customerCount} customers in ${Date.now() - startMs}ms`);

  return {
    customerCount,
    durationMs: Date.now() - startMs,
    refreshedAt: refreshedAt.toISOString(),
    mode: effectiveMode,
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
  // Stale if not refreshed within the last 25 hours (daily job + 1 hour slack).
  const staleCutoff = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const isStale = count === 0 || (refreshedAt !== null && refreshedAt < staleCutoff);

  return {
    customerCount: count,
    refreshedAt: refreshedAt?.toISOString() ?? null,
    isStale,
  };
}
