import { env } from '../config/env';
import { getSourcePool } from '../db/source-db';
import { buildMerchantFilterSql, buildServiceCaseSql } from './subscription-merchants';

// ============================================================================
// Types
// ============================================================================

export interface SubscriptionCandidate {
  mobileNr: string;
  firstName: string | null;
  lastName: string | null;
  accountId: string;
  panMasked: string | null;
  serviceName: string;
  chargeCount: number;
  lastChargeDate: Date;
  avgAmount: number;
  avgIntervalDays: number | null;
  currentBalance: number;
}

export interface ServiceMedian {
  serviceName: string;
  meanIntervalDays: number;
  establishedCount: number;
}

// ============================================================================
// SQL fragments (built once at module load)
// ============================================================================

const SUCCESS_SERVICE_CASE = buildServiceCaseSql('t.card_acceptor_name_loc');
const SUCCESS_MERCHANT_FILTER = buildMerchantFilterSql('t.card_acceptor_name_loc');

// ============================================================================
// Queries
// ============================================================================

/**
 * Fetches all subscription candidates from the source DB.
 *
 * Returns one row per (account_id, pan_masked, service_name) active within
 * the last 90 days, enriched with customer details and current USD balance.
 */
export async function fetchSubscriptionCandidates(): Promise<SubscriptionCandidate[]> {
  const pool = await getSourcePool();

  // ── Query 1: subscription stats (omari_reporting only — no cross-DB joins) ───
  const statsSql = `
    WITH
    SuccessFiltered AS (
      SELECT
        t.account_id,
        t.pan_masked,
        t.settle_amount_rsp       AS amount,
        t.datetime_tran_local     AS tran_date,
        ${SUCCESS_SERVICE_CASE}   AS service_name
      FROM omari_reporting.dbo.omzw_usd_sec_trans t WITH (NOLOCK)
      WHERE t.tran_type_text = 'VISA Purchase Completion'
        AND t.datetime_tran_local >= DATEADD(day, -90, GETDATE())
        AND ${SUCCESS_MERCHANT_FILTER}
    )
    SELECT
      account_id,
      pan_masked,
      service_name,
      COUNT(*)                                                          AS charge_count,
      MAX(tran_date)                                                    AS last_charge_date,
      CAST(AVG(CAST(amount AS FLOAT)) AS DECIMAL(18, 4))               AS avg_amount,
      CASE
        WHEN COUNT(*) >= 2
        THEN DATEDIFF(day, MIN(tran_date), MAX(tran_date)) / (COUNT(*) - 1)
        ELSE NULL
      END                                                               AS avg_interval_days
    FROM SuccessFiltered
    WHERE service_name IS NOT NULL
    GROUP BY account_id, pan_masked, service_name
  `;

  const statsReq = pool.request();
  (statsReq as unknown as { timeout: number }).timeout = env.SOURCE_SQL_REQUEST_TIMEOUT_MS;
  const statsResult = await statsReq.query(statsSql);
  const stats: any[] = statsResult.recordset;

  console.log(`[SubscriptionDetection] Query 1 done — ${stats.length} candidate rows`);

  if (stats.length === 0) return [];

  // Build a deduplicated account ID list for targeted lookups.
  const accountIds = [...new Set(stats.map((r: any) => String(r.account_id)))];
  const idList = accountIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

  // ── Queries 2 & 3: run in parallel ───────────────────────────────────────────

  // Query 2: customer info (omari_dp — no cross-DB join)
  const customerSql = `
    SELECT
      a.AccountId     AS account_id,
      dc.MobileNumber AS mobile_nr,
      dc.FirstName    AS first_name,
      dc.LastName     AS last_name
    FROM reporting.df_usd_accounts a WITH (NOLOCK)
    JOIN reporting.dim_customer dc WITH (NOLOCK)
      ON dc.CIF = a.CIF
    WHERE a.AccountId IN (${idList})
  `;

  // Query 3: current balances (omari_dp — no cross-DB join)
  const balanceSql = `
    SELECT account_number AS account_id, available_balance
    FROM reporting.omari_account_balances_usd_current WITH (NOLOCK)
    WHERE account_number IN (${idList})
  `;

  const [customerResult, balanceResult] = await Promise.all([
    pool.request().query(customerSql),
    pool.request().query(balanceSql),
  ]);

  console.log(`[SubscriptionDetection] Queries 2/3 done — customers=${customerResult.recordset.length} balances=${balanceResult.recordset.length}`);

  // Build lookup maps
  const customerMap = new Map<string, { mobileNr: string; firstName: string | null; lastName: string | null }>();
  for (const row of customerResult.recordset) {
    customerMap.set(String(row.account_id).toLowerCase(), {
      mobileNr:  String(row.mobile_nr ?? ''),
      firstName: row.first_name ?? null,
      lastName:  row.last_name ?? null,
    });
  }

  const balanceMap = new Map<string, number>();
  for (const row of balanceResult.recordset) {
    balanceMap.set(String(row.account_id).toLowerCase(), Number(row.available_balance));
  }

  return stats.map((row: any): SubscriptionCandidate => {
    const customer = customerMap.get(String(row.account_id).toLowerCase());
    const currentBalance = balanceMap.get(String(row.account_id).toLowerCase()) ?? 0;

    return {
      mobileNr:             customer?.mobileNr ?? '',
      firstName:            customer?.firstName ?? null,
      lastName:             customer?.lastName ?? null,
      accountId:            String(row.account_id ?? ''),
      panMasked:            row.pan_masked ?? null,
      serviceName:          String(row.service_name),
      chargeCount:          Number(row.charge_count),
      lastChargeDate:       new Date(row.last_charge_date),
      avgAmount:            Number(row.avg_amount),
      avgIntervalDays:      row.avg_interval_days != null ? Number(row.avg_interval_days) : null,
      currentBalance,
    };
  });
}

export const MIN_ESTABLISHED_COUNT = 10;
export const FALLBACK_INTERVAL_DAYS = 30;

/**
 * Computes service medians in-memory from an already-fetched candidates array.
 * Candidates with 2+ charges already have avgIntervalDays populated, so there
 * is no need for a second database query.
 */
export function computeServiceMediansFromCandidates(candidates: SubscriptionCandidate[]): ServiceMedian[] {
  const byService = new Map<string, number[]>();
  for (const c of candidates) {
    if (c.chargeCount >= 2 && c.avgIntervalDays !== null) {
      const arr = byService.get(c.serviceName) ?? [];
      arr.push(c.avgIntervalDays);
      byService.set(c.serviceName, arr);
    }
  }
  const result: ServiceMedian[] = [];
  for (const [serviceName, intervals] of byService) {
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    result.push({ serviceName, meanIntervalDays: Math.round(mean), establishedCount: intervals.length });
  }
  return result;
}

/**
 * Fetches service medians directly from the DB (standalone / for diagnostics).
 * The main reminder flow uses computeServiceMediansFromCandidates() instead.
 */

export async function fetchServiceMedians(): Promise<ServiceMedian[]> {
  const pool = await getSourcePool();

  const sql = `
    WITH
    SuccessTrans AS (
      SELECT
        t.account_id,
        t.pan_masked,
        t.datetime_tran_local     AS tran_date,
        ${SUCCESS_SERVICE_CASE}   AS service_name
      FROM omari_reporting.dbo.omzw_usd_sec_trans t WITH (NOLOCK)
      WHERE t.tran_type_text = 'VISA Purchase Completion'
        AND t.datetime_tran_local >= DATEADD(day, -90, GETDATE())
        AND ${SUCCESS_MERCHANT_FILTER}
    ),
    SuccessFiltered AS (
      SELECT * FROM SuccessTrans WHERE service_name IS NOT NULL
    ),
    PerCustomer AS (
      SELECT
        service_name,
        DATEDIFF(day, MIN(tran_date), MAX(tran_date)) / (COUNT(*) - 1) AS customer_avg_interval
      FROM SuccessFiltered
      GROUP BY account_id, pan_masked, service_name
      HAVING COUNT(*) >= 2
    )
    SELECT
      service_name,
      CAST(AVG(CAST(customer_avg_interval AS FLOAT)) AS INT) AS mean_interval_days,
      COUNT(*) AS established_count
    FROM PerCustomer
    GROUP BY service_name
  `;

  const result = await pool.request().query(sql);

  return result.recordset.map((row: any): ServiceMedian => ({
    serviceName:       String(row.service_name),
    meanIntervalDays:  Number(row.mean_interval_days),
    establishedCount:  Number(row.established_count),
  }));
}
