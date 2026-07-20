// Focused re-run of the two queries that timed out in explore-flowcash.js
// 0a — customer overlap (FLOCASH vs direct Starlink)
// 0b — monthly regularity (rewritten to avoid FORMAT() which kills perf)
// 0d — Starlink-tier amount clustering
//
// Run from backend/ folder:   node explore-flocash-v2.js

const sql = require('mssql');

const config = {
  server: '172.16.7.216',
  port: 1433,
  database: 'omari_dp',
  user: 'Devwork',
  password: 'Kick1221',
  options: { encrypt: true, trustServerCertificate: true, serverName: 'OMSVR-OMARI-DB' },
  connectionTimeout: 15000,
  requestTimeout: 300000, // 5 minutes per query
};

async function q(pool, label, query) {
  console.log(`\n${'='.repeat(60)}\n${label}\n${'='.repeat(60)}`);
  try {
    const r = await pool.request().query(query);
    if (r.recordset.length === 0) { console.log('(no rows)'); return []; }
    console.table(r.recordset);
    return r.recordset;
  } catch (e) { console.error('ERROR:', e.message); return []; }
}

async function run() {
  const pool = await sql.connect(config);
  console.log('Connected to omari_dp\n');

  // ---------------------------------------------------------------
  // 0a  STEP 1 — fetch FLOCASH distinct customers into JS memory
  //     Avoids the NOT IN subquery that caused O(n²) timeout.
  //     We pull two small distinct ID lists and compare in Node.
  // ---------------------------------------------------------------
  console.log('\n' + '='.repeat(60));
  console.log('0a (step 1/3) — FLOCASH distinct customers (last 365 days)');
  console.log('='.repeat(60));
  let flocashIds = new Set();
  try {
    const r = await pool.request().query(`
      SELECT DISTINCT account_id
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND tran_type_text IN ('VISA Purchase Completion','VISA POS Domestic Purchase')
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    `);
    r.recordset.forEach(row => flocashIds.add(row.account_id));
    console.log(`  -> ${flocashIds.size} unique FLOCASH payers`);
  } catch (e) { console.error('ERROR:', e.message); }

  // 0a  STEP 2 — fetch direct-Starlink distinct customers
  console.log('\n' + '='.repeat(60));
  console.log('0a (step 2/3) — Direct Starlink distinct customers (last 365 days)');
  console.log('='.repeat(60));
  let starlinkIds = new Set();
  try {
    const r = await pool.request().query(`
      SELECT DISTINCT account_id
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%STARLINK%'
        AND tran_type_text IN ('VISA Purchase Completion','VISA POS Domestic Purchase')
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    `);
    r.recordset.forEach(row => starlinkIds.add(row.account_id));
    console.log(`  -> ${starlinkIds.size} unique direct Starlink payers`);
  } catch (e) { console.error('ERROR:', e.message); }

  // 0a  STEP 3 — compute overlap in JavaScript (instant, no SQL join)
  console.log('\n' + '='.repeat(60));
  console.log('0a (step 3/3) — Overlap computed in Node (no SQL join)');
  console.log('='.repeat(60));
  const bothCount       = [...flocashIds].filter(id => starlinkIds.has(id)).length;
  const flocashOnlyCount = flocashIds.size - bothCount;
  console.table([{
    flocash_customers_total:       flocashIds.size,
    starlink_direct_total:         starlinkIds.size,
    pay_BOTH_flocash_and_starlink: bothCount,
    flocash_only_NOT_starlink_direct: flocashOnlyCount,
    pct_flocash_only: ((flocashOnlyCount / flocashIds.size) * 100).toFixed(1) + '%',
  }]);

  // ---------------------------------------------------------------
  // 0b  Monthly regularity — REWRITTEN
  //     Replace FORMAT(date,'yyyy-MM') with YEAR()*100+MONTH()
  //     integer math — sargable, avoids per-row string conversion.
  //     Adds tran_type_text filter to halve the rows scanned.
  // ---------------------------------------------------------------
  await q(pool, '0b. Monthly regularity — Starlink proxy signal (rewritten)', `
    WITH monthly AS (
      SELECT
        account_id,
        YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local) AS ym,
        CAST(SUM(settle_amount_rsp) AS DECIMAL(18,2))                AS paid_that_month
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND tran_type_text IN ('VISA Purchase Completion','VISA POS Domestic Purchase')
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
      GROUP BY account_id,
               YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local)
    ),
    cust AS (
      SELECT account_id,
        COUNT(DISTINCT ym)                           AS active_months,
        CAST(AVG(paid_that_month) AS DECIMAL(18,2))  AS avg_monthly,
        CAST(SUM(paid_that_month) AS DECIMAL(18,2))  AS total_paid
      FROM monthly
      GROUP BY account_id
    )
    SELECT
      CASE
        WHEN active_months >= 10 THEN '10-12 months active'
        WHEN active_months >= 7  THEN '7-9 months active'
        WHEN active_months >= 4  THEN '4-6 months active'
        ELSE '1-3 months active'
      END                                          AS retention_band,
      COUNT(*)                                     AS customer_count,
      CAST(AVG(avg_monthly) AS DECIMAL(18,2))      AS avg_monthly_payment,
      CAST(AVG(total_paid)  AS DECIMAL(18,2))      AS avg_annual_spend,
      COUNT(CASE WHEN active_months >= 10 AND avg_monthly >= 100 THEN 1 END) AS likely_resellers
    FROM cust
    GROUP BY
      CASE
        WHEN active_months >= 10 THEN '10-12 months active'
        WHEN active_months >= 7  THEN '7-9 months active'
        WHEN active_months >= 4  THEN '4-6 months active'
        ELSE '1-3 months active'
      END
    ORDER BY MIN(active_months) DESC
  `);

  // ---------------------------------------------------------------
  // 0b-detail  Among the 10-12 month cohort: payment amount bands
  //            to see how many are single-sub vs resellers
  // ---------------------------------------------------------------
  await q(pool, '0b-detail. 10-12 month regulars — payment size breakdown', `
    WITH monthly AS (
      SELECT
        account_id,
        YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local) AS ym,
        CAST(SUM(settle_amount_rsp) AS DECIMAL(18,2))                AS paid_that_month
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND tran_type_text IN ('VISA Purchase Completion','VISA POS Domestic Purchase')
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
      GROUP BY account_id,
               YEAR(datetime_tran_local) * 100 + MONTH(datetime_tran_local)
    ),
    cust AS (
      SELECT account_id,
        COUNT(DISTINCT ym)                           AS active_months,
        CAST(AVG(paid_that_month) AS DECIMAL(18,2))  AS avg_monthly
      FROM monthly
      GROUP BY account_id
      HAVING COUNT(DISTINCT ym) >= 10
    )
    SELECT
      CASE
        WHEN avg_monthly < 60    THEN '$0-60  (1 sub ~$50)'
        WHEN avg_monthly < 130   THEN '$60-130 (1-2 subs)'
        WHEN avg_monthly < 260   THEN '$130-260 (2-3 subs, small reseller)'
        WHEN avg_monthly < 500   THEN '$260-500 (3-5 subs, mid reseller)'
        ELSE '$500+ (large reseller)'
      END                        AS monthly_spend_band,
      COUNT(*)                   AS customer_count,
      CAST(AVG(avg_monthly) AS DECIMAL(18,2)) AS avg_monthly_payment
    FROM cust
    GROUP BY
      CASE
        WHEN avg_monthly < 60    THEN '$0-60  (1 sub ~$50)'
        WHEN avg_monthly < 130   THEN '$60-130 (1-2 subs)'
        WHEN avg_monthly < 260   THEN '$130-260 (2-3 subs, small reseller)'
        WHEN avg_monthly < 500   THEN '$260-500 (3-5 subs, mid reseller)'
        ELSE '$500+ (large reseller)'
      END
    ORDER BY MIN(avg_monthly)
  `);

  // ---------------------------------------------------------------
  // 0d  Starlink-tier amount clustering — broken into 2 halves
  //     so each scan covers ~6 months instead of 12, avoiding timeout.
  //     Half 1: Jul 2025 – Dec 2025
  //     Half 2: Jan 2026 – Jul 2026
  // ---------------------------------------------------------------
  for (const [label, startDate, endDate] of [
    ['0d-H1. Starlink-tier clustering Jul–Dec 2025', '2025-07-01', '2026-01-01'],
    ['0d-H2. Starlink-tier clustering Jan–Jul 2026', '2026-01-01', '2026-07-18'],
  ]) {
    await q(pool, label, `
      SELECT
        CASE
          WHEN settle_amount_rsp BETWEEN 45  AND 55   THEN '~$50     (1 sub)'
          WHEN settle_amount_rsp BETWEEN 90  AND 130  THEN '~$100-120 (1-2 subs)'
          WHEN settle_amount_rsp BETWEEN 130 AND 170  THEN '~$150    (small reseller)'
          WHEN settle_amount_rsp BETWEEN 200 AND 260  THEN '~$240    (2-sub reseller)'
          WHEN settle_amount_rsp BETWEEN 300 AND 400  THEN '~$360    (3-sub reseller)'
          WHEN settle_amount_rsp BETWEEN 400 AND 650  THEN '~$480-600 (4-5 sub reseller)'
          WHEN settle_amount_rsp > 650               THEN '$650+     (large reseller)'
          ELSE 'other amount'
        END                                       AS starlink_tier,
        COUNT(*)                                  AS txn_count,
        COUNT(DISTINCT account_id)                AS unique_customers,
        CAST(SUM(settle_amount_rsp) AS DECIMAL(18,2)) AS total_usd,
        CAST(AVG(settle_amount_rsp) AS DECIMAL(18,2)) AS avg_amount
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND tran_type_text IN ('VISA Purchase Completion','VISA POS Domestic Purchase')
        AND settle_amount_rsp > 0
        AND datetime_tran_local >= '${startDate}'
        AND datetime_tran_local <  '${endDate}'
      GROUP BY
        CASE
          WHEN settle_amount_rsp BETWEEN 45  AND 55   THEN '~$50     (1 sub)'
          WHEN settle_amount_rsp BETWEEN 90  AND 130  THEN '~$100-120 (1-2 subs)'
          WHEN settle_amount_rsp BETWEEN 130 AND 170  THEN '~$150    (small reseller)'
          WHEN settle_amount_rsp BETWEEN 200 AND 260  THEN '~$240    (2-sub reseller)'
          WHEN settle_amount_rsp BETWEEN 300 AND 400  THEN '~$360    (3-sub reseller)'
          WHEN settle_amount_rsp BETWEEN 400 AND 650  THEN '~$480-600 (4-5 sub reseller)'
          WHEN settle_amount_rsp > 650               THEN '$650+     (large reseller)'
          ELSE 'other amount'
        END
      ORDER BY MIN(settle_amount_rsp)
    `);
  }

  await pool.close();
  console.log('\nDone.');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
