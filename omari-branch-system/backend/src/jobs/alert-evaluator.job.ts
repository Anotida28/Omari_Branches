/**
 * Alert Evaluator Job
 *
 * Phase 3: Daily scheduled job that:
 * 1. Acquires a DB lock to prevent duplicate runs
 * 2. Loads active rules and eligible expenses
 * 3. Evaluates which alerts should fire
 * 4. For each candidate:
 *    - Checks if already logged (deduplication)
 *    - Fetches active recipients for the branch
 *    - Sends email and logs the result
 */

import { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma";
import {
  evaluateAlerts,
  getTodayInHarare,
  formatDateString,
  type AlertCandidate,
  type AlertRuleInput,
  type EligibleExpenseInput,
} from "../services/alert-evaluation.service";
import { sendAlertEmail, type AlertEmailPayload } from "../services/email.service";
import { withLock } from "../services/job-lock.service";

// ============================================================================
// Constants
// ============================================================================

const JOB_NAME = "daily-alert-evaluator";
const JOB_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes lease (heartbeat-renewed)

// Range of days to look at expenses (covers all possible rule offsets)
const EXPENSE_DATE_RANGE_DAYS = 60;

// ============================================================================
// Types
// ============================================================================

export type AlertJobResult = {
  evaluationDate: string;
  totalCandidates: number;
  skippedAlreadySent: number;
  skippedNoRecipients: number;
  sentCount: number;
  failedCount: number;
  errors: string[];
};

type BranchInfo = {
  city: string;
  label: string;
  displayName: string;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Load all active alert rules from the database.
 */
async function loadActiveRules(): Promise<AlertRuleInput[]> {
  const rules = await prisma.alertRule.findMany({
    where: { isActive: true },
  });

  return rules.map((r) => ({
    id: r.id,
    ruleType: r.ruleType,
    dayOffset: r.dayOffset,
    isActive: r.isActive,
  }));
}

/**
 * Load eligible expenses within the date range needed for evaluation.
 * Includes joined payments to compute balanceRemaining.
 */
async function loadEligibleExpenses(today: Date): Promise<EligibleExpenseInput[]> {
  // Calculate date range
  const rangeStart = new Date(today.getTime() - EXPENSE_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(today.getTime() + EXPENSE_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000);

  const expenses = await prisma.expense.findMany({
    where: {
      status: { not: "PAID" },
      dueDate: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
    include: {
      payments: {
        select: { amountPaid: true },
      },
    },
  });

  // Map to EligibleExpenseInput with computed balanceRemaining
  return expenses.map((e) => {
    const amount = new Prisma.Decimal(e.amount);
    const totalPaid = e.payments.reduce(
      (sum, p) => sum.plus(p.amountPaid),
      new Prisma.Decimal(0)
    );
    const balanceRemaining = amount.minus(totalPaid);

    return {
      id: e.id,
      branchId: e.branchId,
      expenseType: e.expenseType,
      period: e.period,
      dueDate: e.dueDate,
      amount: amount.toString(),
      status: e.status,
      balanceRemaining: balanceRemaining.toString(),
    };
  }).filter((e) => parseFloat(e.balanceRemaining) > 0);
}

/**
 * Check if an alert has already been sent for this candidate.
 * Dedupe key: (expenseId, ruleId, triggerLocalDate)
 * Block only when a SENT log exists for this key.
 */
function parseTriggerLocalDate(triggerDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(triggerDate);
  if (!match) {
    throw new Error(`Invalid trigger local date: ${triggerDate}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid trigger local date: ${triggerDate}`);
  }
  return date;
}

async function isAlertAlreadySent(
  candidate: AlertCandidate
): Promise<boolean> {
  const triggerLocalDate = parseTriggerLocalDate(candidate.triggerDate);
  const count = await prisma.alertLog.count({
    where: {
      expenseId: candidate.expenseId,
      ruleId: candidate.ruleId,
      triggerLocalDate,
      status: "SENT",
    },
  });

  return count > 0;
}

/**
 * Get active recipients for a branch.
 */
async function getActiveRecipients(branchId: bigint): Promise<string[]> {
  const recipients = await prisma.branchRecipient.findMany({
    where: {
      branchId,
      isActive: true,
    },
    select: { email: true },
  });

  return recipients.map((r) => r.email);
}

/**
 * Get branch info for display in emails.
 */
async function getBranchInfo(branchId: bigint): Promise<BranchInfo | null> {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { city: true, label: true },
  });

  if (!branch) return null;

  return {
    city: branch.city,
    label: branch.label,
    displayName: `${branch.city} - ${branch.label}`,
  };
}

/**
 * Log an alert result to the database.
 */
async function logAlertResult(
  candidate: AlertCandidate,
  email: string,
  status: "SENT" | "FAILED" | "SKIPPED",
  errorMessage?: string
): Promise<void> {
  const triggerLocalDate = parseTriggerLocalDate(candidate.triggerDate);
  await prisma.alertLog.create({
    data: {
      expenseId: candidate.expenseId,
      ruleId: candidate.ruleId,
      ruleType: candidate.ruleType,
      dayOffset: candidate.dayOffset,
      triggerLocalDate,
      sentTo: email,
      status,
      errorMessage: errorMessage?.slice(0, 500) || null,
    },
  });
}

/**
 * Format amount as currency string.
 */
function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// ============================================================================
// Main Job Function
// ============================================================================

/**
 * Run the alert evaluation job.
 * This is the main entry point for the scheduled job.
 */
export async function runAlertEvaluatorJob(): Promise<AlertJobResult> {
  const today = getTodayInHarare();
  const evaluationDate = formatDateString(today);

  console.log(`[AlertJob] Starting evaluation for ${evaluationDate}`);

  const result: AlertJobResult = {
    evaluationDate,
    totalCandidates: 0,
    skippedAlreadySent: 0,
    skippedNoRecipients: 0,
    sentCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    // Load data
    const [rules, expenses] = await Promise.all([
      loadActiveRules(),
      loadEligibleExpenses(today),
    ]);

    console.log(`[AlertJob] Loaded ${rules.length} active rules, ${expenses.length} eligible expenses`);

    // Evaluate
    const evaluation = evaluateAlerts(today, expenses, rules);
    result.totalCandidates = evaluation.candidates.length;

    console.log(`[AlertJob] Found ${evaluation.candidates.length} alert candidates`);

    // Process each candidate
    for (const candidate of evaluation.candidates) {
      try {
        // Check if already sent
        const alreadySent = await isAlertAlreadySent(candidate);

        if (alreadySent) {
          result.skippedAlreadySent++;
          console.log(`[AlertJob] Skipping ${candidate.alertKey} - already sent`);
          continue;
        }

        // Get recipients
        const recipients = await getActiveRecipients(candidate.branchId);

        if (recipients.length === 0) {
          result.skippedNoRecipients++;
          console.log(`[AlertJob] Skipping ${candidate.alertKey} - no recipients`);

          // Log as SKIPPED
          await logAlertResult(candidate, "no-recipients", "SKIPPED", "No active recipients for branch");
          continue;
        }

        // Get branch info
        const branchInfo = await getBranchInfo(candidate.branchId);
        const branchName = branchInfo?.displayName || `Branch ${candidate.branchId}`;

        // Send to each recipient
        for (const email of recipients) {
          const payload: AlertEmailPayload = {
            to: email,
            branchName,
            expenseType: candidate.expenseType,
            period: candidate.period,
            dueDate: formatDateString(candidate.dueDate),
            amount: formatAmount(candidate.balanceRemaining), // Using balance as "amount to pay"
            balanceRemaining: formatAmount(candidate.balanceRemaining),
            alertType: candidate.ruleType,
            dayOffset: candidate.dayOffset,
          };

          const sendResult = await sendAlertEmail(payload);

          if (sendResult.success) {
            result.sentCount++;
            await logAlertResult(candidate, email, "SENT");
            console.log(`[AlertJob] Sent ${candidate.alertKey} to ${email}`);
          } else {
            result.failedCount++;
            await logAlertResult(candidate, email, "FAILED", sendResult.error);
            console.error(`[AlertJob] Failed ${candidate.alertKey} to ${email}: ${sendResult.error}`);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Error processing ${candidate.alertKey}: ${errorMsg}`);
        console.error(`[AlertJob] Error processing ${candidate.alertKey}:`, error);
      }
    }

    console.log(`[AlertJob] Completed: sent=${result.sentCount}, failed=${result.failedCount}, skipped=${result.skippedAlreadySent + result.skippedNoRecipients}`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Job error: ${errorMsg}`);
    console.error(`[AlertJob] Job failed:`, error);
  }

  return result;
}

/**
 * Run the alert evaluator job with lock protection.
 * This prevents multiple instances from running simultaneously.
 */
export async function runAlertEvaluatorJobWithLock(): Promise<{
  executed: boolean;
  result?: AlertJobResult;
  error?: Error;
}> {
  return withLock(JOB_NAME, runAlertEvaluatorJob, JOB_LOCK_DURATION_MS);
}
