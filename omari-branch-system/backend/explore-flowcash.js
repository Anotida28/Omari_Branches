// Run this on the SERVER (172.16.3.21) inside the backend folder:
//   node explore-flowcash.js
// Then paste the output back.

const sql = require('mssql');

const config = {
  server: '172.16.7.216',
  port: 1433,
  database: 'omari_dp',
  user: 'Devwork',
  password: 'Kick1221',
  options: { encrypt: true, trustServerCertificate: true, serverName: 'OMSVR-OMARI-DB' },
  connectionTimeout: 15000,
  requestTimeout: 120000,
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

  // 0. All databases on this server
  await q(pool, '0. All databases on 172.16.7.216', `
    SELECT name, state_desc, create_date
    FROM sys.databases
    WHERE name NOT IN ('master','tempdb','model','msdb')
    ORDER BY name
  `);

  // 0a. Customers who use BOTH Starlink (directly) AND FLOCASH
  await q(pool, '0a. Overlap — customers paying BOTH Starlink direct AND FLOCASH', `
    WITH flocash_customers AS (
      SELECT DISTINCT account_id FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    ),
    starlink_customers AS (
      SELECT DISTINCT account_id FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%STARLINK%'
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    )
    SELECT
      (SELECT COUNT(*) FROM flocash_customers)   AS flocash_only_total,
      (SELECT COUNT(*) FROM starlink_customers)  AS starlink_direct_total,
      (SELECT COUNT(*) FROM flocash_customers f JOIN starlink_customers s ON f.account_id = s.account_id) AS both,
      (SELECT COUNT(*) FROM flocash_customers f WHERE f.account_id NOT IN (SELECT account_id FROM starlink_customers)) AS flocash_NOT_starlink_direct
  `);

  // 0b. Monthly regularity of FLOCASH — customers paying roughly monthly (Starlink proxies)
  await q(pool, '0b. FLOCASH customers with monthly-ish payment pattern (Starlink proxy signal)', `
    WITH monthly AS (
      SELECT
        account_id,
        FORMAT(datetime_tran_local, 'yyyy-MM') AS month,
        COUNT(*)                               AS txns_that_month,
        CAST(SUM(CASE WHEN tran_type_text IN ('VISA Purchase Completion','VISA POS Domestic Purchase')
                       THEN settle_amount_rsp ELSE 0 END) AS DECIMAL(18,2)) AS paid_that_month
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
      GROUP BY account_id, FORMAT(datetime_tran_local, 'yyyy-MM')
    ),
    cust_summary AS (
      SELECT account_id,
        COUNT(DISTINCT month)                            AS active_months,
        CAST(AVG(paid_that_month) AS DECIMAL(18,2))     AS avg_monthly_paid,
        CAST(MIN(paid_that_month) AS DECIMAL(18,2))     AS min_monthly_paid,
        CAST(MAX(paid_that_month) AS DECIMAL(18,2))     AS max_monthly_paid,
        CAST(SUM(paid_that_month) AS DECIMAL(18,2))     AS total_paid
      FROM monthly
      GROUP BY account_id
    )
    SELECT
      CASE
        WHEN active_months >= 10 THEN '10-12 months active'
        WHEN active_months >= 7  THEN '7-9 months active'
        WHEN active_months >= 4  THEN '4-6 months active'
        ELSE '1-3 months active'
      END                                               AS retention_band,
      COUNT(*)                                          AS customer_count,
      CAST(AVG(avg_monthly_paid) AS DECIMAL(18,2))      AS avg_monthly_payment,
      CAST(AVG(total_paid) AS DECIMAL(18,2))            AS avg_annual_spend
    FROM cust_summary
    GROUP BY
      CASE
        WHEN active_months >= 10 THEN '10-12 months active'
        WHEN active_months >= 7  THEN '7-9 months active'
        WHEN active_months >= 4  THEN '4-6 months active'
        ELSE '1-3 months active'
      END
    ORDER BY MIN(active_months) DESC
  `);

  // 0c. Likely Starlink resellers — high monthly spend through FLOCASH
  await q(pool, '0c. Likely Starlink RESELLERS — top FLOCASH spenders by monthly avg', `
    WITH monthly AS (
      SELECT
        account_id,
        FORMAT(datetime_tran_local, 'yyyy-MM') AS month,
        CAST(SUM(CASE WHEN tran_type_text IN ('VISA Purchase Completion','VISA POS Domestic Purchase')
                       THEN settle_amount_rsp ELSE 0 END) AS DECIMAL(18,2)) AS paid_that_month
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
      GROUP BY account_id, FORMAT(datetime_tran_local, 'yyyy-MM')
    )
    SELECT TOP 25
      account_id,
      COUNT(DISTINCT month)                             AS active_months,
      CAST(AVG(paid_that_month) AS DECIMAL(18,2))       AS avg_monthly_payment,
      CAST(MAX(paid_that_month) AS DECIMAL(18,2))       AS peak_month_payment,
      CAST(SUM(paid_that_month) AS DECIMAL(18,2))       AS total_paid_yr,
      CAST(AVG(paid_that_month) / 120.0 AS DECIMAL(10,1)) AS est_starlink_subs_managed
    FROM monthly
    GROUP BY account_id
    HAVING COUNT(DISTINCT month) >= 3
    ORDER BY avg_monthly_payment DESC
  `);

  // 0d. Amount clustering — are FLOCASH amounts multiples of Starlink price ($50/$100/$120/$150)?
  await q(pool, '0d. FLOCASH completion amounts — Starlink-tier clustering', `
    WITH completions AS (
      SELECT settle_amount_rsp AS amt
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND tran_type_text IN ('VISA Purchase Completion','VISA POS Domestic Purchase')
        AND settle_amount_rsp > 0
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    )
    SELECT
      CASE
        WHEN amt BETWEEN 45  AND 55   THEN '~$50 (1 sub?)'
        WHEN amt BETWEEN 90  AND 130  THEN '~$100-120 (1-2 subs?)'
        WHEN amt BETWEEN 130 AND 170  THEN '~$150 (reseller small)'
        WHEN amt BETWEEN 200 AND 260  THEN '~$240 (2 subs reseller)'
        WHEN amt BETWEEN 300 AND 400  THEN '~$360 (3 subs reseller)'
        WHEN amt BETWEEN 400 AND 650  THEN '~$480-600 (4-5 subs reseller)'
        WHEN amt > 650                THEN '$650+ (large reseller)'
        ELSE 'other amount'
      END                           AS starlink_tier,
      COUNT(*)                      AS txn_count,
      COUNT(DISTINCT account_id)    AS unique_customers,
      CAST(SUM(amt) AS DECIMAL(18,2)) AS total_usd
    FROM completions
    GROUP BY
      CASE
        WHEN amt BETWEEN 45  AND 55   THEN '~$50 (1 sub?)'
        WHEN amt BETWEEN 90  AND 130  THEN '~$100-120 (1-2 subs?)'
        WHEN amt BETWEEN 130 AND 170  THEN '~$150 (reseller small)'
        WHEN amt BETWEEN 200 AND 260  THEN '~$240 (2 subs reseller)'
        WHEN amt BETWEEN 300 AND 400  THEN '~$360 (3 subs reseller)'
        WHEN amt BETWEEN 400 AND 650  THEN '~$480-600 (4-5 subs reseller)'
        WHEN amt > 650                THEN '$650+ (large reseller)'
        ELSE 'other amount'
      END
    ORDER BY MIN(amt)
  `);

  // 0. All FLOCASH transaction types — understand what we're dealing with
  await q(pool, '0. FLOCASH — all tran_type_text variants (last 365 days)', `
    SELECT tran_type_text, COUNT(*) AS cnt,
      CAST(SUM(settle_amount_rsp) AS DECIMAL(18,2)) AS total_usd
    FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
    WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
      AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    GROUP BY tran_type_text
    ORDER BY cnt DESC
  `);

  // 1. Overall summary (last 365 days, all tran types)
  await q(pool, '1. FLOCASH — overall summary last 365 days', `
    SELECT
      COUNT(*)                                        AS total_txns,
      COUNT(DISTINCT account_id)                      AS unique_customers,
      CAST(SUM(settle_amount_rsp) AS DECIMAL(18,2))   AS total_usd,
      CAST(AVG(CAST(settle_amount_rsp AS FLOAT)) AS DECIMAL(18,2)) AS avg_amount,
      CAST(MIN(settle_amount_rsp) AS DECIMAL(18,2))   AS min_amount,
      CAST(MAX(settle_amount_rsp) AS DECIMAL(18,2))   AS max_amount,
      MIN(datetime_tran_local)                        AS first_ever,
      MAX(datetime_tran_local)                        AS last_seen
    FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
    WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
      AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
  `);

  // 2. Monthly volume trend
  await q(pool, '2. FLOCASH — monthly trend (last 365 days)', `
    SELECT
      FORMAT(datetime_tran_local, 'yyyy-MM')           AS month,
      COUNT(*)                                          AS txn_count,
      COUNT(DISTINCT account_id)                        AS unique_customers,
      CAST(SUM(settle_amount_rsp) AS DECIMAL(18,2))     AS total_usd,
      CAST(AVG(CAST(settle_amount_rsp AS FLOAT)) AS DECIMAL(18,2)) AS avg_amount
    FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
    WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
      AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    GROUP BY FORMAT(datetime_tran_local, 'yyyy-MM')
    ORDER BY month
  `);

  // 3. Day-of-week pattern
  await q(pool, '3. FLOCASH — day of week pattern', `
    SELECT
      DATENAME(dw, datetime_tran_local)               AS day_name,
      DATEPART(dw, datetime_tran_local)               AS day_num,
      COUNT(*)                                        AS txn_count,
      CAST(AVG(CAST(settle_amount_rsp AS FLOAT)) AS DECIMAL(18,2)) AS avg_amount,
      CAST(SUM(settle_amount_rsp) AS DECIMAL(18,2))   AS total_usd
    FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
    WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
      AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    GROUP BY DATENAME(dw, datetime_tran_local), DATEPART(dw, datetime_tran_local)
    ORDER BY day_num
  `);

  // 4. Hour-of-day pattern
  await q(pool, '4. FLOCASH — hour of day pattern', `
    SELECT
      DATEPART(hour, datetime_tran_local)             AS hour_of_day,
      COUNT(*)                                        AS txn_count,
      CAST(AVG(CAST(settle_amount_rsp AS FLOAT)) AS DECIMAL(18,2)) AS avg_amount
    FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
    WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
      AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    GROUP BY DATEPART(hour, datetime_tran_local)
    ORDER BY hour_of_day
  `);

  // 5. Amount buckets — what sizes are people withdrawing
  await q(pool, '5. FLOCASH — amount distribution buckets', `
    SELECT
      CASE
        WHEN settle_amount_rsp = 0          THEN '0 (auth/pending)'
        WHEN settle_amount_rsp < 10         THEN '$0.01 – $9.99'
        WHEN settle_amount_rsp < 20         THEN '$10 – $19.99'
        WHEN settle_amount_rsp < 50         THEN '$20 – $49.99'
        WHEN settle_amount_rsp < 100        THEN '$50 – $99.99'
        WHEN settle_amount_rsp < 200        THEN '$100 – $199.99'
        WHEN settle_amount_rsp < 500        THEN '$200 – $499.99'
        ELSE '$500+'
      END                                             AS amount_bucket,
      COUNT(*)                                        AS txn_count,
      COUNT(DISTINCT account_id)                      AS unique_customers,
      CAST(SUM(settle_amount_rsp) AS DECIMAL(18,2))   AS total_usd
    FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
    WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
      AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    GROUP BY
      CASE
        WHEN settle_amount_rsp = 0          THEN '0 (auth/pending)'
        WHEN settle_amount_rsp < 10         THEN '$0.01 – $9.99'
        WHEN settle_amount_rsp < 20         THEN '$10 – $19.99'
        WHEN settle_amount_rsp < 50         THEN '$20 – $49.99'
        WHEN settle_amount_rsp < 100        THEN '$50 – $99.99'
        WHEN settle_amount_rsp < 200        THEN '$100 – $199.99'
        WHEN settle_amount_rsp < 500        THEN '$200 – $499.99'
        ELSE '$500+'
      END
    ORDER BY MIN(settle_amount_rsp)
  `);

  // 6. Customer frequency — how often do people use it
  await q(pool, '6. FLOCASH — customer frequency segments', `
    WITH cust AS (
      SELECT account_id, COUNT(*) AS txn_count,
        CAST(SUM(settle_amount_rsp) AS DECIMAL(18,2)) AS total_spent
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
      GROUP BY account_id
    )
    SELECT
      CASE
        WHEN txn_count = 1  THEN '1x (one-time)'
        WHEN txn_count <= 3 THEN '2-3x'
        WHEN txn_count <= 6 THEN '4-6x'
        WHEN txn_count <= 12 THEN '7-12x'
        ELSE '13+ (power user)'
      END                          AS frequency_band,
      COUNT(*)                     AS customer_count,
      CAST(AVG(total_spent) AS DECIMAL(18,2)) AS avg_spend_per_customer,
      CAST(SUM(total_spent) AS DECIMAL(18,2)) AS total_revenue
    FROM cust
    GROUP BY
      CASE
        WHEN txn_count = 1  THEN '1x (one-time)'
        WHEN txn_count <= 3 THEN '2-3x'
        WHEN txn_count <= 6 THEN '4-6x'
        WHEN txn_count <= 12 THEN '7-12x'
        ELSE '13+ (power user)'
      END
    ORDER BY MIN(txn_count)
  `);

  // 7. Days between transactions per customer — regularity check
  await q(pool, '7. FLOCASH — avg days between visits (repeat customers only)', `
    WITH dated AS (
      SELECT account_id, datetime_tran_local,
        LAG(datetime_tran_local) OVER (PARTITION BY account_id ORDER BY datetime_tran_local) AS prev_tran
      FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
      WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
        AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
    ),
    gaps AS (
      SELECT account_id,
        DATEDIFF(day, prev_tran, datetime_tran_local) AS gap_days
      FROM dated WHERE prev_tran IS NOT NULL
    )
    SELECT
      CASE
        WHEN gap_days <= 1   THEN 'Same/next day'
        WHEN gap_days <= 7   THEN '2-7 days'
        WHEN gap_days <= 14  THEN '8-14 days'
        WHEN gap_days <= 30  THEN '15-30 days'
        ELSE '30+ days'
      END                    AS gap_bucket,
      COUNT(*)               AS occurrences,
      CAST(AVG(CAST(gap_days AS FLOAT)) AS DECIMAL(10,1)) AS avg_gap_days
    FROM gaps
    GROUP BY
      CASE
        WHEN gap_days <= 1   THEN 'Same/next day'
        WHEN gap_days <= 7   THEN '2-7 days'
        WHEN gap_days <= 14  THEN '8-14 days'
        WHEN gap_days <= 30  THEN '15-30 days'
        ELSE '30+ days'
      END
    ORDER BY MIN(gap_days)
  `);

  // 8. Top 20 heaviest FLOCASH users
  await q(pool, '8. FLOCASH — top 20 customers by total spend', `
    SELECT TOP 20
      account_id,
      COUNT(*)                                      AS txn_count,
      CAST(SUM(settle_amount_rsp) AS DECIMAL(18,2)) AS total_usd,
      CAST(AVG(CAST(settle_amount_rsp AS FLOAT)) AS DECIMAL(18,2)) AS avg_amount,
      MIN(datetime_tran_local)                      AS first_txn,
      MAX(datetime_tran_local)                      AS last_txn
    FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK)
    WHERE card_acceptor_name_loc LIKE '%FLOCASH%'
      AND datetime_tran_local >= DATEADD(day, -365, GETDATE())
      AND settle_amount_rsp > 0
    GROUP BY account_id
    ORDER BY total_usd DESC
  `);

  await pool.close();
  console.log('\nDone.');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
