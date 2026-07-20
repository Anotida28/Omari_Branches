import { getSourcePool } from '../db/source-db';

// ── Constants ─────────────────────────────────────────────────────────────

const ANALYTICS_TIMEOUT_MS = 300_000; // 5 min per query — these are heavy scans
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2-hour cache

const SUCCESS_TYPES = `('VISA Purchase Completion','VISA POS Domestic Purchase')`;

const TIER_ORDER: Record<string, number> = {
  '~$50 (1 sub)':      1,
  '~$110 (1-2 subs)':  2,
  '~$150 (small)':     3,
  '~$240 (2 subs)':    4,
  '~$360 (3 subs)':    5,
  '~$540 (4-5 subs)':  6,
  '$650+ (reseller)':  7,
};

const TIER_CASE = `
  CASE
    WHEN settle_amount_rsp BETWEEN 45  AND 55   THEN '~$50 (1 sub)'
    WHEN settle_amount_rsp BETWEEN 90  AND 130  THEN '~$110 (1-2 subs)'
    WHEN settle_amount_rsp BETWEEN 130 AND 170  THEN '~$150 (small)'
    WHEN settle_amount_rsp BETWEEN 200 AND 260  THEN '~$240 (2 subs)'
    WHEN settle_amount_rsp BETWEEN 300 AND 400  THEN '~$360 (3 subs)'
    WHEN settle_amount_rsp BETWEEN 400 AND 650  THEN '~$540 (4-5 subs)'
    WHEN settle_amount_rsp > 650               THEN '$650+ (reseller)'
    ELSE 'other'
  END`;

// ── Types ─────────────────────────────────────────────────────────────────

export interface FlocashAnalytics {
  generatedAt: string;
  queryMs: number;
  kpis: {
    totalCustomers: number;
    totalVolume: number;
    successfulTxns: number;
    failedTxns: number;
    failRate: number;
    flocashOnly: number;
    flocashOnlyPct: number;
  };
  overlap: {
    flocashTotal: number;
    starlinkTotal: number;
    both: number;
    flocashOnly: number;
    starlinkOnly: number;
  };
  regularity: Array<{ band: string; customerCount: number; avgMonthly: number; avgAnnual: number }>;
  monthlyTrend: Array<{ yearMonth: number; label: string; txnCount: number; customerCount: number; totalUsd: number }>;
  tierClustering: Array<{ tier: string; sortOrder: number; h1TxnCount: number; h2TxnCount: number }>;
  cohort10to12: Array<{ band: string; customerCount: number; avgMonthly: number }>;
  resellers: Array<{
    accountId: string;
    mobileNr: string | null;
    firstName: string | null;
    lastName: string | null;
    activeMonths: number;
    avgMonthlyPayment: number;
    peakMonthPayment: number;
    totalPaidYr: number;
    successfulTxns: number;
    failedTxns: number;
  }>;
}

export interface ResellerMonthlyDetail {
  accountId: string;
  months: Array<{
    yearMonth: number;
    label: string;
    successfulTxns: number;
    failedTxns: number;
    totalAmountPaid: number;
  }>;
}

// ── Cache ─────────────────────────────────────────────────────────────────

let _cache: { data: FlocashAnalytics; expiresAt: number } | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────

function ymLabel(ym: number): string {
  const y = Math.floor(ym / 100);
  const m = ym % 100;
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[m - 1]} '${String(y).slice(2)}`;
}

function makeReq(pool: Awaited<ReturnType<typeof getSourcePool>>) {
  const req = pool.request();
  (req as unknown as { timeout: number }).timeout = ANALYTICS_TIMEOUT_MS;
  return req;
}

// ── Main analytics ────────────────────────────────────────────────────────

export async function fetchFlocashAnalytics(forceRefresh = false): Promise<FlocashAnalytics> {
  if (!forceRefresh && _cache && Date.now() < _cache.expiresAt) {
    return _cache.data;
  }

  const t0 = Date.now();
  const pool = await getSourcePool();

  // Phase 1: KPI + overlap ID lists (parallel — all fast-ish)
  const [kpiRes, flocashIdsRes, starlinkIdsRes] = await Promise.all([
    makeReq(pool).query(`
      SELECT
        COUNT(DISTINCT account_id) AS total_customers,
        COUNT(CASE WHEN tran_type_text IN ${SUCCESS_TYPES} AND settle_amount_rsp > 0 THEN 1 END) AS successful_txns,
        COUNT(CASE WHEN tran_type_text NOT IN ${SUCCESS_TYPES}                         THEN 1 END) AS failed_txns,
        CAST(SUM(CASE WHEN tran_type_text IN ${SUCCESS_TYPES} AND settle_amount_rsp > 0
                      THEN settle_amount_rsp ELSE 0 END) AS DECIMAL(18,2))                       AS total_volume
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    `),
    makeReq(pool).query(`
      SELECT DISTINCT account_id
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND tran_type_text IN ${SUCCESS_TYPES}
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    `),
    makeReq(pool).query(`
      SELECT DISTINCT account_id
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%STARLINK%'
        AND tran_type_text IN ${SUCCESS_TYPES}
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    `),
  ]);

  // Compute overlap in JS — avoids O(n²) NOT IN subquery
  const flocashSet = new Set<string>(flocashIdsRes.recordset.map((r: any) => String(r.account_id)));
  const starlinkSet = new Set<string>(starlinkIdsRes.recordset.map((r: any) => String(r.account_id)));
  const bothCount = [...flocashSet].filter(id => starlinkSet.has(id)).length;
  const flocashOnlyCount = flocashSet.size - bothCount;
  const starlinkOnlyCount = starlinkSet.size - bothCount;

  const kpi = kpiRes.recordset[0];
  const successfulTxns = Number(kpi.successful_txns);
  const failedTxns     = Number(kpi.failed_txns);
  const totalTxns      = successfulTxns + failedTxns;
  const failRate       = totalTxns > 0 ? Math.round((failedTxns / totalTxns) * 1000) / 10 : 0;

  // Phase 2: Regularity + Trend + Tier H1 + Tier H2 (parallel)
  const [regularityRes, trendRes, tierH1Res, tierH2Res] = await Promise.all([
    makeReq(pool).query(`
      WITH monthly AS (
        SELECT
          account_id,
          YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local) AS ym,
          CAST(SUM(settle_amount_rsp) AS DECIMAL(18,2))                 AS paid_that_month
        FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
        WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
          AND tran_type_text IN ${SUCCESS_TYPES}
          AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
        GROUP BY account_id, YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local)
      ),
      cust AS (
        SELECT account_id,
          COUNT(DISTINCT ym)                           AS active_months,
          CAST(AVG(paid_that_month) AS DECIMAL(18,2))  AS avg_monthly,
          CAST(SUM(paid_that_month) AS DECIMAL(18,2))  AS total_paid
        FROM monthly GROUP BY account_id
      )
      SELECT
        CASE
          WHEN active_months >= 10 THEN '10-12 months'
          WHEN active_months >= 7  THEN '7-9 months'
          WHEN active_months >= 4  THEN '4-6 months'
          ELSE '1-3 months'
        END                                          AS band,
        COUNT(*)                                     AS customer_count,
        CAST(AVG(avg_monthly) AS DECIMAL(18,2))      AS avg_monthly,
        CAST(AVG(total_paid)  AS DECIMAL(18,2))      AS avg_annual
      FROM cust
      GROUP BY CASE
        WHEN active_months >= 10 THEN '10-12 months'
        WHEN active_months >= 7  THEN '7-9 months'
        WHEN active_months >= 4  THEN '4-6 months'
        ELSE '1-3 months'
      END
      ORDER BY MIN(active_months) DESC
    `),
    makeReq(pool).query(`
      SELECT
        YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local) AS year_month,
        COUNT(*)                                                        AS txn_count,
        COUNT(DISTINCT account_id)                                      AS customer_count,
        CAST(SUM(settle_amount_rsp) AS DECIMAL(18,2))                  AS total_usd
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND tran_type_text IN ${SUCCESS_TYPES}
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
      GROUP BY YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local)
      ORDER BY year_month
    `),
    makeReq(pool).query(`
      SELECT ${TIER_CASE} AS tier, COUNT(*) AS txn_count
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND tran_type_text IN ${SUCCESS_TYPES}
        AND settle_amount_rsp > 0
        AND datetime_tran_local >= '2025-07-01'
        AND datetime_tran_local <  '2026-01-01'
      GROUP BY ${TIER_CASE}
    `),
    makeReq(pool).query(`
      SELECT ${TIER_CASE} AS tier, COUNT(*) AS txn_count
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND tran_type_text IN ${SUCCESS_TYPES}
        AND settle_amount_rsp > 0
        AND datetime_tran_local >= '2026-01-01'
        AND datetime_tran_local <  GETDATE()
      GROUP BY ${TIER_CASE}
    `),
  ]);

  // Phase 3: 10-12 month cohort + reseller base list (parallel)
  const [cohortRes, resellersBaseRes] = await Promise.all([
    makeReq(pool).query(`
      WITH monthly AS (
        SELECT
          account_id,
          YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local) AS ym,
          CAST(SUM(settle_amount_rsp) AS DECIMAL(18,2))                 AS paid_that_month
        FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
        WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
          AND tran_type_text IN ${SUCCESS_TYPES}
          AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
        GROUP BY account_id, YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local)
      ),
      cust AS (
        SELECT account_id,
          COUNT(DISTINCT ym)                           AS active_months,
          CAST(AVG(paid_that_month) AS DECIMAL(18,2))  AS avg_monthly
        FROM monthly GROUP BY account_id
        HAVING COUNT(DISTINCT ym) >= 10
      )
      SELECT
        CASE
          WHEN avg_monthly < 60    THEN '$0-60 / mo'
          WHEN avg_monthly < 130   THEN '$60-130 / mo'
          WHEN avg_monthly < 260   THEN '$130-260 / mo'
          WHEN avg_monthly < 500   THEN '$260-500 / mo'
          ELSE '$500+ / mo'
        END                                          AS band,
        COUNT(*)                                     AS customer_count,
        CAST(AVG(avg_monthly) AS DECIMAL(18,2))      AS avg_monthly
      FROM cust
      GROUP BY CASE
        WHEN avg_monthly < 60    THEN '$0-60 / mo'
        WHEN avg_monthly < 130   THEN '$60-130 / mo'
        WHEN avg_monthly < 260   THEN '$130-260 / mo'
        WHEN avg_monthly < 500   THEN '$260-500 / mo'
        ELSE '$500+ / mo'
      END
      ORDER BY MIN(avg_monthly)
    `),
    makeReq(pool).query(`
      WITH monthly AS (
        SELECT
          account_id,
          YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local) AS ym,
          CAST(SUM(CASE WHEN tran_type_text IN ${SUCCESS_TYPES}
                        THEN settle_amount_rsp ELSE 0 END) AS DECIMAL(18,2)) AS paid_that_month
        FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
        WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
          AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
        GROUP BY account_id, YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local)
      )
      SELECT TOP 30
        account_id,
        COUNT(DISTINCT ym)                           AS active_months,
        CAST(AVG(paid_that_month) AS DECIMAL(18,2))  AS avg_monthly_payment,
        CAST(MAX(paid_that_month) AS DECIMAL(18,2))  AS peak_month_payment,
        CAST(SUM(paid_that_month) AS DECIMAL(18,2))  AS total_paid_yr
      FROM monthly
      GROUP BY account_id
      HAVING COUNT(DISTINCT ym) >= 3
        AND AVG(paid_that_month) >= 200
      ORDER BY avg_monthly_payment DESC
    `),
  ]);

  // Phase 4: Reseller txn counts + customer names (parallel, conditional)
  let resellers: FlocashAnalytics['resellers'] = [];
  if (resellersBaseRes.recordset.length > 0) {
    const resellerIds = resellersBaseRes.recordset.map((r: any) => String(r.account_id));
    const idList = resellerIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

    const [txnCountsRes, customerRes] = await Promise.all([
      makeReq(pool).query(`
        SELECT
          account_id,
          COUNT(CASE WHEN tran_type_text IN ${SUCCESS_TYPES} AND settle_amount_rsp > 0 THEN 1 END) AS successful_txns,
          COUNT(CASE WHEN tran_type_text NOT IN ${SUCCESS_TYPES}                         THEN 1 END) AS failed_txns
        FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
        WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
          AND account_id IN (${idList})
          AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
        GROUP BY account_id
      `),
      makeReq(pool).query(`
        SELECT
          a.AccountId     AS account_id,
          dc.MobileNumber AS mobile_nr,
          dc.FirstName    AS first_name,
          dc.LastName     AS last_name
        FROM reporting.df_usd_accounts a WITH (NOLOCK)
        JOIN reporting.dim_customer dc WITH (NOLOCK) ON dc.CIF = a.CIF
        WHERE a.AccountId IN (${idList})
      `),
    ]);

    const txnMap = new Map<string, { successfulTxns: number; failedTxns: number }>();
    for (const row of txnCountsRes.recordset) {
      txnMap.set(String(row.account_id), {
        successfulTxns: Number(row.successful_txns),
        failedTxns:     Number(row.failed_txns),
      });
    }
    const customerMap = new Map<string, { mobileNr: string | null; firstName: string | null; lastName: string | null }>();
    for (const row of customerRes.recordset) {
      customerMap.set(String(row.account_id).toLowerCase(), {
        mobileNr:  row.mobile_nr  ?? null,
        firstName: row.first_name ?? null,
        lastName:  row.last_name  ?? null,
      });
    }

    resellers = resellersBaseRes.recordset.map((row: any) => {
      const id   = String(row.account_id);
      const txns = txnMap.get(id) ?? { successfulTxns: 0, failedTxns: 0 };
      const cust = customerMap.get(id.toLowerCase());
      return {
        accountId:         id,
        mobileNr:          cust?.mobileNr  ?? null,
        firstName:         cust?.firstName ?? null,
        lastName:          cust?.lastName  ?? null,
        activeMonths:      Number(row.active_months),
        avgMonthlyPayment: Number(row.avg_monthly_payment),
        peakMonthPayment:  Number(row.peak_month_payment),
        totalPaidYr:       Number(row.total_paid_yr),
        successfulTxns:    txns.successfulTxns,
        failedTxns:        txns.failedTxns,
      };
    });
  }

  // Merge tier H1 + H2 into unified list
  const tierMap = new Map<string, { h1: number; h2: number }>();
  for (const row of tierH1Res.recordset) {
    const tier = row.tier as string;
    if (tier === 'other') continue;
    tierMap.set(tier, { h1: Number(row.txn_count), h2: 0 });
  }
  for (const row of tierH2Res.recordset) {
    const tier = row.tier as string;
    if (tier === 'other') continue;
    const entry = tierMap.get(tier) ?? { h1: 0, h2: 0 };
    entry.h2 = Number(row.txn_count);
    tierMap.set(tier, entry);
  }
  const tierClustering = [...tierMap.entries()]
    .map(([tier, counts]) => ({
      tier,
      sortOrder: TIER_ORDER[tier] ?? 99,
      h1TxnCount: counts.h1,
      h2TxnCount: counts.h2,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const data: FlocashAnalytics = {
    generatedAt: new Date().toISOString(),
    queryMs:     Date.now() - t0,
    kpis: {
      totalCustomers:  Number(kpi.total_customers),
      totalVolume:     Number(kpi.total_volume),
      successfulTxns,
      failedTxns,
      failRate,
      flocashOnly:     flocashOnlyCount,
      flocashOnlyPct:  Math.round((flocashOnlyCount / Math.max(flocashSet.size, 1)) * 1000) / 10,
    },
    overlap: {
      flocashTotal:  flocashSet.size,
      starlinkTotal: starlinkSet.size,
      both:          bothCount,
      flocashOnly:   flocashOnlyCount,
      starlinkOnly:  starlinkOnlyCount,
    },
    regularity: regularityRes.recordset.map((row: any) => ({
      band:          row.band,
      customerCount: Number(row.customer_count),
      avgMonthly:    Number(row.avg_monthly),
      avgAnnual:     Number(row.avg_annual),
    })),
    monthlyTrend: trendRes.recordset.map((row: any) => ({
      yearMonth:     Number(row.year_month),
      label:         ymLabel(Number(row.year_month)),
      txnCount:      Number(row.txn_count),
      customerCount: Number(row.customer_count),
      totalUsd:      Number(row.total_usd),
    })),
    tierClustering,
    cohort10to12: cohortRes.recordset.map((row: any) => ({
      band:          row.band,
      customerCount: Number(row.customer_count),
      avgMonthly:    Number(row.avg_monthly),
    })),
    resellers,
  };

  _cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  console.log(`[FlocashAnalytics] Done in ${data.queryMs}ms, cached for 2h`);
  return data;
}

// ── Reseller monthly detail ───────────────────────────────────────────────

export async function fetchResellerDetail(accountId: string): Promise<ResellerMonthlyDetail> {
  const pool = await getSourcePool();
  const sanitized = accountId.replace(/'/g, "''");
  const req = makeReq(pool);

  const result = await req.query(`
    SELECT
      YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local)                               AS year_month,
      COUNT(CASE WHEN tran_type_text IN ${SUCCESS_TYPES} AND settle_amount_rsp > 0 THEN 1 END)   AS successful_txns,
      COUNT(CASE WHEN tran_type_text NOT IN ${SUCCESS_TYPES}                         THEN 1 END)  AS failed_txns,
      CAST(SUM(CASE WHEN tran_type_text IN ${SUCCESS_TYPES} AND settle_amount_rsp > 0
                    THEN settle_amount_rsp ELSE 0 END) AS DECIMAL(18,2))                          AS total_amount_paid
    FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
    WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
      AND account_id = '${sanitized}'
      AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    GROUP BY YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local)
    ORDER BY year_month
  `);

  return {
    accountId,
    months: result.recordset.map((row: any) => ({
      yearMonth:       Number(row.year_month),
      label:           ymLabel(Number(row.year_month)),
      successfulTxns:  Number(row.successful_txns),
      failedTxns:      Number(row.failed_txns),
      totalAmountPaid: Number(row.total_amount_paid),
    })),
  };
}
