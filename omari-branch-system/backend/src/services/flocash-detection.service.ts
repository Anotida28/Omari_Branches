import { env } from '../config/env';
import { getSourcePool } from '../db/source-db';

// ============================================================================
// Types
// ============================================================================

export interface FlocashCandidate {
  mobileNr: string;
  firstName: string | null;
  lastName: string | null;
  accountId: string;
  chargeCount: number;
  lastChargeDate: Date;
  avgAmount: number;
  modalDayOfMonth: number; // most common payment day-of-month in last 90 days
  currentBalance: number;
}

// Customers averaging >= $200/month through FLOCASH are likely resellers —
// excluded because their payment behaviour is business-driven, not personal.
export const FLOCASH_RESELLER_THRESHOLD = 200;

// Minimum successful FLOCASH payments in the last 90 days to qualify.
export const FLOCASH_MIN_CHARGES = 2;

// How many days ahead of the predicted payment date to send the reminder.
export const FLOCASH_LOOK_AHEAD_DAYS = 5;

// ============================================================================
// Detection query
// ============================================================================

export async function fetchFlocashCandidates(): Promise<FlocashCandidate[]> {
  const pool = await getSourcePool();

  // Query 1 — FLOCASH regulars from the last 90 days, non-resellers only.
  // Uses YEAR()*100+MONTH() integer math instead of FORMAT() to stay sargable.
  // Modal day is the day-of-month they most commonly pay (tie-broken by latest).
  const statsSql = `
    WITH completions AS (
      SELECT
        account_id,
        CAST(settle_amount_rsp AS DECIMAL(18,4))   AS amount,
        datetime_tran_local                         AS tran_date,
        DAY(datetime_tran_local)                    AS pay_day
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND tran_type_text IN ('VISA Purchase Completion','VISA POS Domestic Purchase')
        AND settle_amount_rsp > 0
        AND datetime_tran_local >= DATEADD(day, -90, GETDATE())
    ),
    stats AS (
      SELECT
        account_id,
        COUNT(*)                                              AS charge_count,
        MAX(tran_date)                                        AS last_charge_date,
        CAST(AVG(CAST(amount AS FLOAT)) AS DECIMAL(18,4))    AS avg_amount
      FROM completions
      GROUP BY account_id
      HAVING COUNT(*) >= ${FLOCASH_MIN_CHARGES}
        AND AVG(CAST(amount AS FLOAT)) < ${FLOCASH_RESELLER_THRESHOLD}
    ),
    day_counts AS (
      SELECT c.account_id, c.pay_day, COUNT(*) AS cnt
      FROM completions c
      JOIN stats s ON s.account_id = c.account_id
      GROUP BY c.account_id, c.pay_day
    ),
    modal_days AS (
      -- ROW_NUMBER picks the most frequent day; tie-break by highest day so we
      -- err on the side of a later prediction (better than reminding too early).
      SELECT account_id, pay_day AS modal_day,
        ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY cnt DESC, pay_day DESC) AS rn
      FROM day_counts
    )
    SELECT
      s.account_id,
      s.charge_count,
      s.last_charge_date,
      s.avg_amount,
      md.modal_day
    FROM stats s
    JOIN modal_days md ON md.account_id = s.account_id AND md.rn = 1
  `;

  const statsReq = pool.request();
  (statsReq as unknown as { timeout: number }).timeout = env.SOURCE_SQL_REQUEST_TIMEOUT_MS;
  const statsResult = await statsReq.query(statsSql);
  const stats: any[] = statsResult.recordset;

  console.log(`[FlocashDetection] Query 1 done — ${stats.length} candidate rows`);
  if (stats.length === 0) return [];

  const accountIds = [...new Set(stats.map((r: any) => String(r.account_id)))];

  const ID_BATCH   = 1000;
  const CONCURRENCY = 4;
  const batches: string[][] = [];
  for (let i = 0; i < accountIds.length; i += ID_BATCH) {
    batches.push(accountIds.slice(i, i + ID_BATCH));
  }

  const buildIdList = (ids: string[]) =>
    ids.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

  const customerRows: any[] = [];
  const balanceRows: any[]  = [];

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const window = batches.slice(i, i + CONCURRENCY);
    await Promise.all(
      window.map(async (batch) => {
        const idList = buildIdList(batch);
        const [cRes, bRes] = await Promise.all([
          pool.request().query(`
            SELECT
              a.AccountId     AS account_id,
              dc.MobileNumber AS mobile_nr,
              dc.FirstName    AS first_name,
              dc.LastName     AS last_name
            FROM reporting.df_usd_accounts a WITH (NOLOCK)
            JOIN reporting.dim_customer dc WITH (NOLOCK)
              ON dc.CIF = a.CIF
            WHERE a.AccountId IN (${idList})
          `),
          pool.request().query(`
            SELECT account_number AS account_id, available_balance
            FROM reporting.omari_account_balances_usd_current WITH (NOLOCK)
            WHERE account_number IN (${idList})
          `),
        ]);
        customerRows.push(...cRes.recordset);
        balanceRows.push(...bRes.recordset);
      }),
    );
  }

  console.log(`[FlocashDetection] Queries 2/3 done — customers=${customerRows.length} balances=${balanceRows.length}`);

  const customerMap = new Map<string, { mobileNr: string; firstName: string | null; lastName: string | null }>();
  for (const row of customerRows) {
    customerMap.set(String(row.account_id).toLowerCase(), {
      mobileNr:  String(row.mobile_nr ?? ''),
      firstName: row.first_name ?? null,
      lastName:  row.last_name ?? null,
    });
  }

  const balanceMap = new Map<string, number>();
  for (const row of balanceRows) {
    balanceMap.set(String(row.account_id).toLowerCase(), Number(row.available_balance));
  }

  return stats.map((row: any): FlocashCandidate => {
    const key      = String(row.account_id).toLowerCase();
    const customer = customerMap.get(key);
    return {
      mobileNr:        customer?.mobileNr ?? '',
      firstName:       customer?.firstName ?? null,
      lastName:        customer?.lastName ?? null,
      accountId:       String(row.account_id),
      chargeCount:     Number(row.charge_count),
      lastChargeDate:  new Date(row.last_charge_date),
      avgAmount:       Number(row.avg_amount),
      modalDayOfMonth: Number(row.modal_day),
      currentBalance:  balanceMap.get(key) ?? 0,
    };
  });
}
