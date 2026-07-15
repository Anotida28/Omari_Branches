import { prisma } from '../db/prisma';
import {
  FALLBACK_INTERVAL_DAYS,
  MIN_ESTABLISHED_COUNT,
  type ServiceMedian,
  type SubscriptionCandidate,
  computeServiceMediansFromCandidates,
  fetchSubscriptionCandidates,
} from './subscription-detection.service';
import { sendSms } from './sms.service';
import {
  calculateOmariVisaFee,
  calculateTotalNeeded,
} from './subscription-merchants';
import { isSmsSendingEnabled } from './system-config.service';

// ============================================================================
// Types
// ============================================================================

export interface SubscriptionReminderResult {
  runDate: string;
  candidatesDetected: number;
  sufficientBalanceSkipped: number;
  alreadySentSkipped: number;
  smsSentCount: number;
  smsFailedCount: number;
  lane1Count: number;
  lane2aCount: number;
}

export interface SmsPreviewEntry {
  mobileNr: string;
  customerName: string;
  serviceName: string;
  lane: '1' | '2A';
  subscriptionAmount: number;
  feeAmount: number;
  totalNeeded: number;
  currentBalance: number;
  topUpAmount: number;
  predictedChargeDate: string | null;
  daysUntilCharge: number | null;
  message: string;
}

export interface SmsPreviewResult {
  generatedAt: string;
  generationMs: number;
  totalCandidatesScanned: number;
  sufficientBalanceSkipped: number;
  totalToSend: number;
  lane1Count: number;
  lane2aCount: number;
  byService: Record<string, number>;
  totalTopUpNeeded: number;
  entries: SmsPreviewEntry[];
}

interface ClassifiedSubscription {
  mobileNr: string;
  firstName: string;
  customerName: string;
  serviceName: string;
  lane: '1' | '2A';
  subscriptionAmount: number;
  feeAmount: number;
  totalNeeded: number;
  currentBalance: number;
  topUpAmount: number;
  predictedChargeDate: Date;
  daysUntilCharge: number | null;
}

// ============================================================================
// Lane classification
// ============================================================================

const LOOK_AHEAD_DAYS      = 3;   // send SMS when payment is this many days away
const LANE1_MAX_INTERVAL   = 45;  // days — cap on avg billing interval for Lane 1
const LANE1_MIN_INTERVAL   = 20;
const LANE1_MAX_LAPSE      = 50;  // days since last charge before subscription is considered lapsed
const LANE2A_MIN_DAYS_AGO  = 20;  // only consider 1-charge customers whose charge was ≥20 days ago
const LANE2A_MAX_DAYS_AGO  = 40;

function buildMedianMap(medians: ServiceMedian[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of medians) {
    const interval = m.establishedCount >= MIN_ESTABLISHED_COUNT
      ? m.meanIntervalDays
      : FALLBACK_INTERVAL_DAYS;
    map.set(m.serviceName, interval);
  }
  return map;
}

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function classifyCandidates(
  candidates: SubscriptionCandidate[],
  medianMap: Map<string, number>,
): ClassifiedSubscription[] {
  const today = startOfDay(new Date());
  const classified: ClassifiedSubscription[] = [];

  for (const c of candidates) {
    if (!c.mobileNr) continue;

    const lastCharge     = startOfDay(c.lastChargeDate);
    const daysSinceCharge = daysBetween(lastCharge, today);
    const feeAmount       = calculateOmariVisaFee(c.avgAmount);
    const totalNeeded     = calculateTotalNeeded(c.avgAmount);
    const topUpAmount     = Math.max(0, totalNeeded - c.currentBalance);
    const customerName    = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.mobileNr;

    // ── Lane 1: established subscriber (2+ charges, stable interval) ──────────
    if (
      c.chargeCount >= 2 &&
      c.avgIntervalDays !== null &&
      c.avgIntervalDays >= LANE1_MIN_INTERVAL &&
      c.avgIntervalDays <= LANE1_MAX_INTERVAL &&
      daysSinceCharge <= LANE1_MAX_LAPSE
    ) {
      const predictedDate  = new Date(lastCharge);
      predictedDate.setDate(predictedDate.getDate() + c.avgIntervalDays);
      const daysUntilCharge = daysBetween(today, startOfDay(predictedDate));

      if (daysUntilCharge >= 1 && daysUntilCharge <= LOOK_AHEAD_DAYS) {
        classified.push({
          mobileNr: c.mobileNr,
          firstName: c.firstName || customerName.split(' ')[0],
          customerName,
          serviceName: c.serviceName,
          lane: '1',
          subscriptionAmount: c.avgAmount,
          feeAmount,
          totalNeeded,
          currentBalance: c.currentBalance,
          topUpAmount,
          predictedChargeDate: startOfDay(predictedDate),
          daysUntilCharge,
        });
      }
      continue;
    }

    // ── Lane 2: new subscriber (exactly 1 charge) ─────────────────────────────
    if (c.chargeCount !== 1) continue;

    // Lane 2A: use service median to predict next charge
    if (
      daysSinceCharge >= LANE2A_MIN_DAYS_AGO &&
      daysSinceCharge <= LANE2A_MAX_DAYS_AGO
    ) {
      const medianInterval  = medianMap.get(c.serviceName) ?? FALLBACK_INTERVAL_DAYS;
      const predictedDate   = new Date(lastCharge);
      predictedDate.setDate(predictedDate.getDate() + medianInterval);
      const daysUntilCharge = daysBetween(today, startOfDay(predictedDate));

      if (daysUntilCharge >= 1 && daysUntilCharge <= LOOK_AHEAD_DAYS) {
        classified.push({
          mobileNr: c.mobileNr,
          firstName: c.firstName || customerName.split(' ')[0],
          customerName,
          serviceName: c.serviceName,
          lane: '2A',
          subscriptionAmount: c.avgAmount,
          feeAmount,
          totalNeeded,
          currentBalance: c.currentBalance,
          topUpAmount,
          predictedChargeDate: startOfDay(predictedDate),
          daysUntilCharge,
        });
      }
    }
  }

  return classified;
}

// ============================================================================
// SMS message builder
// ============================================================================

function formatAmount(n: number): string {
  return n.toFixed(2);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });
}

function buildSmsMessage(sub: ClassifiedSubscription): string {
  return (
    `Hi ${sub.firstName}, your ${sub.serviceName} payment of $${formatAmount(sub.subscriptionAmount)} ` +
    `is due on ${formatDate(sub.predictedChargeDate)}. ` +
    `Please ensure you have $${formatAmount(sub.totalNeeded)} in your Omari wallet ` +
    `to avoid a failed charge on your Omari Visa card.`
  );
}

// ============================================================================
// Main orchestrator
// ============================================================================

export async function runSubscriptionSmsReminders(): Promise<SubscriptionReminderResult> {
  const runDate = new Date().toISOString().slice(0, 10);
  console.log(`[SubscriptionSmsReminder] Starting run for ${runDate}`);

  const smsEnabled = await isSmsSendingEnabled();
  if (!smsEnabled) {
    console.log(`[SubscriptionSmsReminder] SMS sending is DISABLED — skipping run`);
    return {
      runDate,
      candidatesDetected:       0,
      sufficientBalanceSkipped: 0,
      alreadySentSkipped:       0,
      smsSentCount:             0,
      smsFailedCount:           0,
      lane1Count:               0,
      lane2aCount:              0,
    };
  }

  const candidates = await fetchSubscriptionCandidates();
  const medians = computeServiceMediansFromCandidates(candidates);

  console.log(`[SubscriptionSmsReminder] Fetched ${candidates.length} candidates, ${medians.length} service medians`);

  const medianMap   = buildMedianMap(medians);
  const classified  = classifyCandidates(candidates, medianMap);

  const result: SubscriptionReminderResult = {
    runDate,
    candidatesDetected:       candidates.length,
    sufficientBalanceSkipped: 0,
    alreadySentSkipped:       0,
    smsSentCount:             0,
    smsFailedCount:           0,
    lane1Count:               0,
    lane2aCount:              0,
  };

  for (const sub of classified) {
    // Skip customers with sufficient balance
    if (sub.topUpAmount <= 0) {
      result.sufficientBalanceSkipped++;
      continue;
    }

    // Dedup: skip if we already sent for this (mobileNr, serviceName, predictedChargeDate)
    const existing = await prisma.subscriptionSmsLog.findFirst({
      where: {
        mobileNr:            sub.mobileNr,
        serviceName:         sub.serviceName,
        predictedChargeDate: sub.predictedChargeDate,
      },
    });

    if (existing) {
      result.alreadySentSkipped++;
      console.log(`[SubscriptionSmsReminder] Already sent to ${sub.mobileNr} for ${sub.serviceName} on ${sub.predictedChargeDate.toISOString().slice(0, 10)} — skipping`);
      continue;
    }

    const message  = buildSmsMessage(sub);
    const smsSent  = await sendSms(sub.mobileNr, message);

    // Persist log regardless of success/failure.
    // Guard against duplicate inserts (P2002) caused by customers with multiple
    // accounts for the same service — the unique constraint on
    // (mobileNr, serviceName, predictedChargeDate) would otherwise crash the run.
    try {
      await prisma.subscriptionSmsLog.create({
        data: {
          mobileNr:            sub.mobileNr,
          serviceName:         sub.serviceName,
          predictedChargeDate: sub.predictedChargeDate,
          lane:                sub.lane,
          subscriptionAmount:  sub.subscriptionAmount,
          feeAmount:           sub.feeAmount,
          totalNeeded:         sub.totalNeeded,
          currentBalance:      sub.currentBalance,
          topUpAmount:         sub.topUpAmount,
          message,
          smsSent,
          smsError:            smsSent ? null : 'Send failed — see console logs',
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        result.alreadySentSkipped++;
        console.log(`[SubscriptionSmsReminder] Duplicate log skipped for ${sub.mobileNr} | ${sub.serviceName}`);
        continue;
      }
      throw err;
    }

    if (smsSent) {
      result.smsSentCount++;
    } else {
      result.smsFailedCount++;
    }

    if (sub.lane === '1')  result.lane1Count++;
    if (sub.lane === '2A') result.lane2aCount++;

    console.log(`[SubscriptionSmsReminder] Lane ${sub.lane} | ${sub.serviceName} | ${sub.mobileNr} | sent=${smsSent}`);
  }

  console.log(`[SubscriptionSmsReminder] Done. sent=${result.smsSentCount} failed=${result.smsFailedCount} skipped-balance=${result.sufficientBalanceSkipped} skipped-dedup=${result.alreadySentSkipped}`);
  return result;
}

// ============================================================================
// Preview (dry-run — no SMS sent, no DB writes)
// ============================================================================

export async function previewSubscriptionSmsReminders(): Promise<SmsPreviewResult> {
  const t0 = Date.now();
  const candidates = await fetchSubscriptionCandidates();
  const medians = computeServiceMediansFromCandidates(candidates);

  const medianMap   = buildMedianMap(medians);
  const classified  = classifyCandidates(candidates, medianMap);

  let sufficientBalanceSkipped = 0;
  const entries: SmsPreviewEntry[] = [];
  const byService: Record<string, number> = {};
  let lane1Count = 0, lane2aCount = 0;
  let totalTopUpNeeded = 0;

  for (const sub of classified) {
    if (sub.topUpAmount <= 0) { sufficientBalanceSkipped++; continue; }

    byService[sub.serviceName] = (byService[sub.serviceName] ?? 0) + 1;
    if (sub.lane === '1')  lane1Count++;
    if (sub.lane === '2A') lane2aCount++;
    totalTopUpNeeded += sub.topUpAmount;

    entries.push({
      mobileNr:            sub.mobileNr,
      customerName:        sub.customerName,
      serviceName:         sub.serviceName,
      lane:                sub.lane,
      subscriptionAmount:  sub.subscriptionAmount,
      feeAmount:           sub.feeAmount,
      totalNeeded:         sub.totalNeeded,
      currentBalance:      sub.currentBalance,
      topUpAmount:         sub.topUpAmount,
      predictedChargeDate: sub.predictedChargeDate
        ? sub.predictedChargeDate.toISOString().slice(0, 10)
        : null,
      daysUntilCharge:     sub.daysUntilCharge,
      message:             buildSmsMessage(sub),
    });
  }

  return {
    generatedAt:            new Date().toISOString(),
    generationMs:           Date.now() - t0,
    totalCandidatesScanned: candidates.length,
    sufficientBalanceSkipped,
    totalToSend:            entries.length,
    lane1Count,
    lane2aCount,
    byService,
    totalTopUpNeeded:       Math.round(totalTopUpNeeded * 100) / 100,
    entries,
  };
}
