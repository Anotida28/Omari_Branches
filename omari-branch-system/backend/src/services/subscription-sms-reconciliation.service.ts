import { prisma } from '../db/prisma';
import { getSourcePool } from '../db/source-db';
import { buildServiceCaseSql, buildMerchantFilterSql } from './subscription-merchants';
import { env } from '../config/env';

const RECON_WINDOW_DAYS = 7;  // days after predictedChargeDate to still look for a charge
const LOOKBACK_DAYS     = 60; // only reconcile SMS sent within this window

export interface ReconciliationResult {
  checkedCount:   number;
  confirmedCount: number; // chargeSucceeded = true
  expiredCount:   number; // chargeSucceeded = false (window closed, no charge found)
  pendingCount:   number; // still within window
}

export async function runSmsReconciliation(): Promise<ReconciliationResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lookbackFrom = new Date(today);
  lookbackFrom.setDate(lookbackFrom.getDate() - LOOKBACK_DAYS);

  // ── 1. Fetch all pending SMS log entries ─────────────────────────────────────
  const pending = await prisma.subscriptionSmsLog.findMany({
    where: {
      smsSent:         true,
      chargeSucceeded: null,
      sentAt:          { gte: lookbackFrom },
    },
    select: {
      id:                  true,
      mobileNr:            true,
      serviceName:         true,
      sentAt:              true,
      predictedChargeDate: true,
    },
  });

  if (pending.length === 0) {
    console.log('[SmsReconciliation] No pending entries to check');
    return { checkedCount: 0, confirmedCount: 0, expiredCount: 0, pendingCount: 0 };
  }

  console.log(`[SmsReconciliation] Checking ${pending.length} pending SMS log entries`);

  // ── 2. Look up account IDs for all mobile numbers (source DB) ────────────────
  const uniqueMobileNrs = [...new Set(pending.map(p => p.mobileNr))];
  const mobileList = uniqueMobileNrs
    .map(m => `'${m.replace(/'/g, "''")}'`)
    .join(',');

  const pool = await getSourcePool();

  const accountSql = `
    SELECT dc.MobileNumber AS mobile_nr, a.AccountId AS account_id
    FROM reporting.dim_customer dc WITH (NOLOCK)
    JOIN reporting.df_usd_accounts a WITH (NOLOCK) ON a.CIF = dc.CIF
    WHERE dc.MobileNumber IN (${mobileList})
  `;

  const accountResult = await pool.request().query(accountSql);

  // mobile → [accountId, ...] (lowercase keys for in-memory matching)
  const mobileToAccountIds = new Map<string, string[]>();
  const allAccountIdsForSql: string[] = [];

  for (const row of accountResult.recordset) {
    const mobile    = String(row.mobile_nr ?? '');
    const accountId = String(row.account_id ?? '');
    if (!mobile || !accountId) continue;

    const arr = mobileToAccountIds.get(mobile) ?? [];
    arr.push(accountId.toLowerCase());
    mobileToAccountIds.set(mobile, arr);
    allAccountIdsForSql.push(accountId);
  }

  const uniqueAccountIds = [...new Set(allAccountIdsForSql)];

  // ── 3. Fetch matching transactions from source DB ────────────────────────────
  const transMap = new Map<string, Array<{ serviceName: string; date: Date; nettFeeEarned: number }>>();

  if (uniqueAccountIds.length > 0) {
    const accountIdList = uniqueAccountIds
      .map(id => `'${id.replace(/'/g, "''")}'`)
      .join(',');

    const minDate = new Date(Math.min(...pending.map(p => p.sentAt.getTime())));
    const maxDate = new Date(Math.max(...pending.map(p => {
      const d = new Date(p.predictedChargeDate);
      d.setDate(d.getDate() + RECON_WINDOW_DAYS);
      return d.getTime();
    })));

    const fmtSql = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19);

    const SERVICE_CASE    = buildServiceCaseSql('t.card_acceptor_name_loc');
    const MERCHANT_FILTER = buildMerchantFilterSql('t.card_acceptor_name_loc');

    const transSql = `
      SELECT
        t.account_id,
        t.datetime_tran_local,
        ABS(ISNULL(t.nettFee, 0)) AS nett_fee_earned,
        ${SERVICE_CASE} AS service_name
      FROM omari_reporting.dbo.omzw_usd_sec_trans t WITH (NOLOCK)
      WHERE t.tran_type_text = 'VISA Purchase Completion'
        AND t.account_id IN (${accountIdList})
        AND t.datetime_tran_local >= '${fmtSql(minDate)}'
        AND t.datetime_tran_local <= '${fmtSql(maxDate)}'
        AND ${MERCHANT_FILTER}
    `;

    const transReq = pool.request();
    (transReq as unknown as { timeout: number }).timeout = env.SOURCE_SQL_REQUEST_TIMEOUT_MS;
    const transResult = await transReq.query(transSql);

    for (const row of transResult.recordset) {
      if (!row.service_name) continue;
      const key     = String(row.account_id ?? '').toLowerCase();
      const entries = transMap.get(key) ?? [];
      entries.push({
        serviceName:   String(row.service_name),
        date:          new Date(row.datetime_tran_local),
        nettFeeEarned: Number(row.nett_fee_earned) || 0,
      });
      transMap.set(key, entries);
    }

    console.log(`[SmsReconciliation] Found ${transResult.recordset.length} candidate transactions`);
  }

  // ── 4. Match each SMS log entry ───────────────────────────────────────────────
  let confirmedCount = 0, expiredCount = 0, pendingCount = 0;

  const updates: Array<{
    id:              bigint;
    chargeSucceeded: boolean;
    chargeDate:      Date | null;
    nettFeeEarned:   number | null;
  }> = [];

  for (const log of pending) {
    const windowEnd = new Date(log.predictedChargeDate);
    windowEnd.setDate(windowEnd.getDate() + RECON_WINDOW_DAYS);

    const accountIds = mobileToAccountIds.get(log.mobileNr) ?? [];
    let matched: { date: Date; nettFeeEarned: number } | null = null;

    for (const accountId of accountIds) {
      const trans = transMap.get(accountId) ?? [];
      // Compare by calendar date (not exact time) for the lower bound —
      // transactions are timestamped at midnight local which can be UTC-2 hours,
      // landing before sentAt (09:00 local = 07:00 UTC) on the same calendar day.
      const sentAtDay = new Date(log.sentAt); sentAtDay.setHours(0, 0, 0, 0);
      const txDay     = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

      const hit = trans.find(t =>
        t.serviceName === log.serviceName &&
        txDay(t.date) >= sentAtDay &&
        t.date <= windowEnd,
      );
      if (hit) { matched = hit; break; }
    }

    if (matched) {
      updates.push({ id: log.id, chargeSucceeded: true, chargeDate: matched.date, nettFeeEarned: matched.nettFeeEarned });
      confirmedCount++;
    } else if (today > windowEnd) {
      updates.push({ id: log.id, chargeSucceeded: false, chargeDate: null, nettFeeEarned: null });
      expiredCount++;
    } else {
      pendingCount++;
    }
  }

  // ── 5. Persist results ────────────────────────────────────────────────────────
  await Promise.all(updates.map(u =>
    prisma.subscriptionSmsLog.update({
      where: { id: u.id },
      data: {
        chargeSucceeded: u.chargeSucceeded,
        chargeDate:      u.chargeDate,
        nettFeeEarned:   u.nettFeeEarned,
      },
    }),
  ));

  console.log(`[SmsReconciliation] Done — confirmed=${confirmedCount} expired=${expiredCount} pending=${pendingCount}`);

  return {
    checkedCount:   pending.length,
    confirmedCount,
    expiredCount,
    pendingCount,
  };
}

// ── Impact stats (reads entirely from app DB) ─────────────────────────────────

const SMS_COST_PER_MESSAGE = 0.01155;

export interface ImpactByService {
  serviceName:    string;
  sent:           number;
  converted:      number;
  conversionRate: number;
  revenue:        number;
}

export interface SmsImpactResult {
  days:                  number;
  smsSent:               number;
  smsCost:               number;
  conversions:           number;
  conversionRate:        number;
  revenueEarned:         number;
  netRoi:                number;
  pendingReconciliation: number;
  byService:             ImpactByService[];
}

export async function getSmsImpactStats(days: number): Promise<SmsImpactResult> {
  const where =
    days > 0
      ? {
          smsSent: true,
          sentAt: {
            gte: new Date(Date.now() - days * 86_400_000),
          },
        }
      : { smsSent: true };

  const all = await prisma.subscriptionSmsLog.findMany({
    where,
    select: {
      serviceName:     true,
      chargeSucceeded: true,
      nettFeeEarned:   true,
    },
  });

  const smsSent    = all.length;
  const smsCost    = smsSent * SMS_COST_PER_MESSAGE;
  const conversions = all.filter(e => e.chargeSucceeded === true).length;
  const conversionRate = smsSent > 0 ? (conversions / smsSent) * 100 : 0;
  const revenueEarned = all
    .filter(e => e.chargeSucceeded === true)
    .reduce((sum, e) => sum + Number(e.nettFeeEarned ?? 0), 0);
  const pendingReconciliation = all.filter(e => e.chargeSucceeded === null).length;

  const serviceMap = new Map<string, { sent: number; converted: number; revenue: number }>();
  for (const e of all) {
    const s = serviceMap.get(e.serviceName) ?? { sent: 0, converted: 0, revenue: 0 };
    s.sent++;
    if (e.chargeSucceeded === true) {
      s.converted++;
      s.revenue += Number(e.nettFeeEarned ?? 0);
    }
    serviceMap.set(e.serviceName, s);
  }

  const byService: ImpactByService[] = [...serviceMap.entries()]
    .map(([serviceName, s]) => ({
      serviceName,
      sent:           s.sent,
      converted:      s.converted,
      conversionRate: s.sent > 0 ? Math.round((s.converted / s.sent) * 100) : 0,
      revenue:        Math.round(s.revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    days,
    smsSent,
    smsCost:               Math.round(smsCost * 10000) / 10000,
    conversions,
    conversionRate:        Math.round(conversionRate * 10) / 10,
    revenueEarned:         Math.round(revenueEarned * 100) / 100,
    netRoi:                Math.round((revenueEarned - smsCost) * 100) / 100,
    pendingReconciliation,
    byService,
  };
}
