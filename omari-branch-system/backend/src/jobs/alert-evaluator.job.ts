/**
 * Alert Evaluator Job
 *
 * Phase 3: Daily scheduled job that:
 * 1. Acquires a DB lock to prevent duplicate runs
 * 2. Loads active rules and eligible expenses
 * 3. Evaluates which alerts should fire
 * 4. For each candidate:
 *    - Checks if already logged (deduplication)
 *    - Fetches active HQ reminder recipients
 *    - Sends email and logs the result
 */

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
import { createEmailLog, EmailSendStatus, EmailType } from "../services/emailer.service";
import { withLock } from "../services/job-lock.service";
import { getActiveRecipientEmails } from "../services/recipients.service";
import { dueDateForMonth, periodForDate } from "../services/recurring-reminders.service";

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
  totalRecurringCandidates: number;
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

type RecurringReminderCandidate = {
  alertKey: string;
  recurringReminderId: bigint;
  branchId: bigint;
  expenseType: string;
  period: string;
  dueDate: Date;
  amount: number;
  ruleId: bigint;
  ruleType: string;
  dayOffset: number;
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
 * Load expenses within the date range needed for evaluation.
 */
async function loadEligibleExpenses(today: Date): Promise<EligibleExpenseInput[]> {
  // Calculate date range
  const rangeStart = new Date(today.getTime() - EXPENSE_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(today.getTime() + EXPENSE_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000);

  const expenses = await prisma.expense.findMany({
    where: {
      dueDate: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
  });

  return expenses.map((expense) => ({
    id: expense.id,
    branchId: expense.branchId,
    expenseType: expense.expenseType,
    period: expense.period,
    dueDate: expense.dueDate,
    amount: expense.amount.toString(),
  }));
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

async function loadBranchMap(branchIds: bigint[]): Promise<Map<string, BranchInfo>> {
  if (branchIds.length === 0) return new Map();

  const branches = await prisma.branch.findMany({
    where: { id: { in: branchIds } },
    select: { id: true, city: true, label: true },
  });

  return new Map(
    branches.map((b) => [
      b.id.toString(),
      { city: b.city, label: b.label, displayName: `${b.city} - ${b.label}` },
    ]),
  );
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

function doesRecurringRuleMatch(rule: AlertRuleInput, daysToDue: number): boolean {
  if (!rule.isActive) return false;
  if (rule.ruleType === "DUE_REMINDER") {
    return daysToDue === Math.abs(rule.dayOffset);
  }
  if (rule.ruleType === "OVERDUE_ESCALATION") {
    return daysToDue < 0 && Math.abs(daysToDue) === rule.dayOffset;
  }
  return false;
}

function buildRecurringCandidateKey(params: {
  recurringReminderId: bigint;
  ruleId: bigint;
  dueDate: Date;
}): string {
  return [
    "recurring",
    params.recurringReminderId.toString(),
    params.ruleId.toString(),
    formatDateString(params.dueDate),
  ].join(":");
}

async function loadRecurringReminderCandidates(
  today: Date,
  rules: AlertRuleInput[],
): Promise<RecurringReminderCandidate[]> {
  const reminders = await prisma.recurringExpenseReminder.findMany({
    where: { isActive: true },
  });
  const activeRules = rules.filter((rule) => rule.isActive);
  const candidates: RecurringReminderCandidate[] = [];

  for (const reminder of reminders) {
    const monthOffsets = [-1, 0, 1];
    for (const monthOffset of monthOffsets) {
      const dueDate = dueDateForMonth(
        today.getUTCFullYear(),
        today.getUTCMonth() + monthOffset,
        reminder.dueDayOfMonth,
      );
      const daysToDue = Math.round((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

      for (const rule of activeRules) {
        if (!doesRecurringRuleMatch(rule, daysToDue)) {
          continue;
        }

        candidates.push({
          alertKey: buildRecurringCandidateKey({
            recurringReminderId: reminder.id,
            ruleId: rule.id,
            dueDate,
          }),
          recurringReminderId: reminder.id,
          branchId: reminder.branchId,
          expenseType: reminder.expenseType,
          period: periodForDate(dueDate),
          dueDate,
          amount: Number(reminder.amount.toString()) || 0,
          ruleId: rule.id,
          ruleType: rule.ruleType,
          dayOffset: rule.dayOffset,
        });
      }
    }
  }

  return candidates;
}

async function isRecurringReminderAlreadySent(
  candidate: RecurringReminderCandidate,
  email: string,
): Promise<boolean> {
  const count = await prisma.emailLog.count({
    where: {
      emailType: EmailType.REMINDER,
      recurringReminderId: candidate.recurringReminderId,
      sentTo: email,
      reportDate: candidate.dueDate,
      status: EmailSendStatus.SENT,
      metadata: `${candidate.ruleType}:${candidate.dayOffset}`,
    },
  });

  return count > 0;
}

async function processRecurringReminderCandidates(
  candidates: RecurringReminderCandidate[],
  recipients: string[],
  result: AlertJobResult,
  branchMap: Map<string, BranchInfo>,
): Promise<void> {
  for (const candidate of candidates) {
    if (recipients.length === 0) {
      result.skippedNoRecipients++;
      await createEmailLog({
        emailType: EmailType.REMINDER,
        sentTo: "no-recipients",
        subject: `Reminder: ${candidate.expenseType} ${candidate.period}`,
        status: EmailSendStatus.SKIPPED,
        branchId: candidate.branchId,
        recurringReminderId: candidate.recurringReminderId,
        reportDate: candidate.dueDate,
        metadata: `${candidate.ruleType}:${candidate.dayOffset}`,
        errorMessage: "No active reminder recipients configured",
      });
      continue;
    }

    const branchName =
      branchMap.get(candidate.branchId.toString())?.displayName ??
      `Branch ${candidate.branchId}`;

    for (const email of recipients) {
      if (await isRecurringReminderAlreadySent(candidate, email)) {
        result.skippedAlreadySent++;
        continue;
      }

      const payload: AlertEmailPayload = {
        to: email,
        branchName,
        expenseType: candidate.expenseType,
        period: candidate.period,
        dueDate: formatDateString(candidate.dueDate),
        amount: formatAmount(candidate.amount),
        alertType: candidate.ruleType,
        dayOffset: candidate.dayOffset,
      };

      const sendResult = await sendAlertEmail(payload);

      if (sendResult.success) {
        result.sentCount++;
        await createEmailLog({
          emailType: EmailType.REMINDER,
          sentTo: email,
          subject: `Reminder: ${branchName} ${candidate.expenseType} ${candidate.period}`,
          status: EmailSendStatus.SENT,
          branchId: candidate.branchId,
          recurringReminderId: candidate.recurringReminderId,
          reportDate: candidate.dueDate,
          metadata: `${candidate.ruleType}:${candidate.dayOffset}`,
        });
      } else {
        result.failedCount++;
        await createEmailLog({
          emailType: EmailType.REMINDER,
          sentTo: email,
          subject: `Reminder: ${branchName} ${candidate.expenseType} ${candidate.period}`,
          status: EmailSendStatus.FAILED,
          errorMessage: sendResult.error,
          branchId: candidate.branchId,
          recurringReminderId: candidate.recurringReminderId,
          reportDate: candidate.dueDate,
          metadata: `${candidate.ruleType}:${candidate.dayOffset}`,
        });
      }
    }
  }
}

// ============================================================================
// Retry
// ============================================================================

async function retryFailedAlerts(
  today: Date,
  recipients: string[],
  result: AlertJobResult,
): Promise<void> {
  const failedLogs = await prisma.alertLog.findMany({
    where: { triggerLocalDate: today, status: "FAILED" },
    include: {
      expense: true,
      rule: true,
    },
  });

  if (failedLogs.length === 0) return;

  console.log(`[AlertJob] Retrying ${failedLogs.length} failed alert(s)...`);

  const branchIds = [...new Set(failedLogs.map((l) => l.expense.branchId))];
  const retryBranchMap = await loadBranchMap(branchIds);

  for (const log of failedLogs) {
    if (!recipients.includes(log.sentTo)) continue;

    const alreadySent = await prisma.alertLog.count({
      where: { expenseId: log.expenseId, ruleId: log.ruleId, triggerLocalDate: today, status: "SENT" },
    });
    if (alreadySent > 0) continue;

    const branchName =
      retryBranchMap.get(log.expense.branchId.toString())?.displayName ??
      `Branch ${log.expense.branchId}`;

    const payload: AlertEmailPayload = {
      to: log.sentTo,
      branchName,
      expenseType: log.expense.expenseType,
      period: log.expense.period,
      dueDate: formatDateString(log.expense.dueDate),
      amount: formatAmount(Number(log.expense.amount.toString()) || 0),
      alertType: log.rule.ruleType,
      dayOffset: log.rule.dayOffset,
    };

    const sendResult = await sendAlertEmail(payload);

    if (sendResult.success) {
      result.sentCount++;
      await prisma.alertLog.create({
        data: {
          expenseId: log.expenseId,
          ruleId: log.ruleId,
          ruleType: log.ruleType,
          dayOffset: log.dayOffset,
          triggerLocalDate: today,
          sentTo: log.sentTo,
          status: "SENT",
          errorMessage: null,
        },
      });
      console.log(`[AlertJob] Retry OK: expense ${log.expenseId} → ${log.sentTo}`);
    } else {
      console.error(`[AlertJob] Retry failed: expense ${log.expenseId} → ${log.sentTo}: ${sendResult.error}`);
    }
  }
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
    totalRecurringCandidates: 0,
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
    const recipients = await getActiveRecipientEmails();
    const recurringCandidates = await loadRecurringReminderCandidates(today, rules);
    result.totalRecurringCandidates = recurringCandidates.length;

    const branchMap = await loadBranchMap(
      Array.from(
        new Set([
          ...evaluation.candidates.map((c) => c.branchId),
          ...recurringCandidates.map((c) => c.branchId),
        ]),
      ),
    );

    console.log(`[AlertJob] Found ${evaluation.candidates.length} alert candidates`);
    console.log(`[AlertJob] Found ${recurringCandidates.length} recurring reminder candidates`);

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

        if (recipients.length === 0) {
          result.skippedNoRecipients++;
          console.log(`[AlertJob] Skipping ${candidate.alertKey} - no HQ recipients`);
          await logAlertResult(
            candidate,
            "no-recipients",
            "SKIPPED",
            "No active HQ reminder recipients configured",
          );
          continue;
        }

        const branchName =
          branchMap.get(candidate.branchId.toString())?.displayName ??
          `Branch ${candidate.branchId}`;

        // Send to each recipient
        for (const email of recipients) {
          const payload: AlertEmailPayload = {
            to: email,
            branchName,
            expenseType: candidate.expenseType,
            period: candidate.period,
            dueDate: formatDateString(candidate.dueDate),
            amount: formatAmount(candidate.amount),
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

    await processRecurringReminderCandidates(recurringCandidates, recipients, result, branchMap);

    await retryFailedAlerts(today, recipients, result);

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
