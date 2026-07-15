/**
 * Job Scheduler
 *
 * Uses node-cron to schedule recurring jobs.
 * All jobs run with DB lock protection to prevent duplicate execution
 * when running multiple API instances.
 */

import cron from "node-cron";

import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { sendEmail } from "../services/email.service";
import { runAlertEvaluatorJobWithLock } from "./alert-evaluator.job";
import { runDailyBranchReportJobWithLock } from "./daily-branch-report.job";
import { runDailyWalletReportJobWithLock } from "./wallet-report.job";
import {
  runSourceMetricsSyncJobWithLock,
  shouldEnableSourceMetricsSync,
} from "./source-metrics-sync.job";
import { runCustomReportJobWithLock } from "./custom-report.job";
import { runWalletSnapshotJobWithLock } from "./wallet-snapshot.job";
import { runSubscriptionSmsReminderJobWithLock } from "./subscription-sms-reminder.job";
import { runSmsReconciliationJobWithLock } from "./subscription-sms-reconciliation.job";

// ============================================================================
// Types
// ============================================================================

type ScheduledJob = {
  name: string;
  cronExpression: string;
  task: ReturnType<typeof cron.schedule>;
};

// ============================================================================
// Job Registry
// ============================================================================

const scheduledJobs: ScheduledJob[] = [];

// ============================================================================
// Cron Expressions
// ============================================================================

// All cron expressions are in Africa/Harare local time.
// node-cron is given { timezone: 'Africa/Harare' } so the server's OS clock
// or timezone setting does not affect when jobs fire.
const CRON_TZ = 'Africa/Harare';

const DAILY_ALERT_CRON                  = "0 8 * * *";   // 08:00 Harare daily
const DAILY_BRANCH_REPORT_CRON          = "0 8 * * *";   // 08:00 Harare daily
const DAILY_WALLET_REPORT_CRON          = "0 8 * * *";   // 08:00 Harare daily
const CUSTOM_REPORT_CRON                = "30 8 * * *";  // 08:30 Harare — after branch/wallet reports
const WALLET_SNAPSHOT_INCREMENTAL_CRON  = "0 4 * * *";   // 04:00 Harare daily — incremental
const WALLET_SNAPSHOT_FULL_CRON         = "0 5 * * 0";   // 05:00 Harare Sunday — full reset
const SOURCE_METRICS_SYNC_CRON          = env.SOURCE_SQL_SYNC_CRON;
const SUBSCRIPTION_SMS_REMINDER_CRON    = "0 9 * * *";   // 09:00 Harare — after balances refresh
const SUBSCRIPTION_SMS_RECON_CRON       = "0 10 * * *";  // 10:00 Harare — after SMS reminders

// ============================================================================
// Job Handlers
// ============================================================================

async function runDailyAlerts(): Promise<void> {
  console.log(`[Scheduler] Running daily alert evaluator at ${new Date().toISOString()}`);

  const { executed, result, error } = await runAlertEvaluatorJobWithLock();

  if (!executed) {
    console.log(`[Scheduler] Alert job skipped - another instance is running`);
    return;
  }

  if (error) {
    console.error(`[Scheduler] Alert job failed with error:`, error);
    return;
  }

  if (result) {
    console.log(`[Scheduler] Alert job completed:`, {
      evaluationDate: result.evaluationDate,
      candidates: result.totalCandidates,
      sent: result.sentCount,
      failed: result.failedCount,
      skipped: result.skippedAlreadySent + result.skippedNoRecipients,
    });
  }
}

async function runDailySourceMetricsSync(): Promise<void> {
  console.log(
    `[Scheduler] Running source metrics sync at ${new Date().toISOString()}`,
  );

  const { executed, result, error } = await runSourceMetricsSyncJobWithLock();

  if (!executed) {
    console.log(
      `[Scheduler] Source metrics sync skipped - another instance is running`,
    );
    return;
  }

  if (error) {
    console.error(`[Scheduler] Source metrics sync failed with error:`, error);
    return;
  }

  if (result) {
    console.log(`[Scheduler] Source metrics sync completed:`, {
      dateFrom: result.dateFrom,
      dateTo: result.dateTo,
      branches: result.branchCount,
      lines: result.lineCount,
      importedRows: result.importedRowCount,
      refreshedBranchDates: result.refreshedBranchDateCount,
      missingSourceLines: result.missingSourceLineCount,
    });
  }
}

async function runDailyBranchReports(): Promise<void> {
  console.log(`[Scheduler] Running daily branch report emailer at ${new Date().toISOString()}`);

  const { executed, result, error } = await runDailyBranchReportJobWithLock();

  if (!executed) {
    console.log(`[Scheduler] Daily branch report job skipped - another instance is running`);
    return;
  }

  if (error) {
    console.error(`[Scheduler] Daily branch report job failed with error:`, error);
    return;
  }

  if (result) {
    console.log(`[Scheduler] Daily branch report job completed:`, {
      reportDate: result.reportDate,
      recipients: result.recipientCount,
      sent: result.sentCount,
      failed: result.failedCount,
      skipped: result.skippedAlreadySent + result.skippedNoMetrics,
    });
  }
}

async function runDailyWalletReports(): Promise<void> {
  console.log(`[Scheduler] Running daily wallet report emailer at ${new Date().toISOString()}`);

  const { executed, result, error } = await runDailyWalletReportJobWithLock();

  if (!executed) {
    console.log(`[Scheduler] Daily wallet report job skipped - another instance is running`);
    return;
  }

  if (error) {
    console.error(`[Scheduler] Daily wallet report job failed with error:`, error);
    return;
  }

  if (result) {
    console.log(`[Scheduler] Daily wallet report job completed:`, {
      reportDate: result.reportDate,
      recipients: result.recipientCount,
      sent: result.sentCount,
      failed: result.failedCount,
      skipped: result.skippedAlreadySent,
    });
  }
}

async function runDailyWalletSnapshotIncremental(): Promise<void> {
  console.log(`[Scheduler] Running daily wallet snapshot (incremental) at ${new Date().toISOString()}`);

  const { executed, result, error } = await runWalletSnapshotJobWithLock("incremental");

  if (!executed) {
    console.log(`[Scheduler] Wallet snapshot job skipped - another instance is running`);
    return;
  }

  if (error) {
    console.error(`[Scheduler] Wallet snapshot incremental job failed:`, error);
    return;
  }

  if (result) {
    console.log(`[Scheduler] Wallet snapshot incremental job completed:`, {
      mode: result.mode,
      customers: result.customerCount,
      durationMs: result.durationMs,
      refreshedAt: result.refreshedAt,
    });
  }
}

async function runDailyCustomReports(): Promise<void> {
  console.log(`[Scheduler] Running daily custom report emailer at ${new Date().toISOString()}`);

  const { executed, result, error } = await runCustomReportJobWithLock();

  if (!executed) {
    console.log(`[Scheduler] Custom report job skipped - another instance is running`);
    return;
  }

  if (error) {
    console.error(`[Scheduler] Custom report job failed with error:`, error);
    return;
  }

  if (result) {
    console.log(`[Scheduler] Custom report job completed:`, {
      reportDate: result.reportDate,
      users: result.usersProcessed,
      sent: result.sentCount,
      failed: result.failedCount,
      skipped: result.skippedCount,
    });
  }
}

const SMS_ALERT_RECIPIENTS = [
  'takudzwag@oldmutual.co.zw',
  'timukudzemah@oldmutual.co.zw',
  'jasperm@oldmutual.co.zw',
  'tanyaradzwau@oldmutual.co.zw',
  'lourencer@oldmutual.co.zw',
];

async function fireSmsJobFailureAlert(candidatesDetected: number, failed: number): Promise<void> {
  try {
    await sendEmail({
      to: SMS_ALERT_RECIPIENTS,
      subject: `[Omari] SMS reminder job sent 0 messages — action needed`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;">
          <h3 style="color:#d32f2f;">Subscription SMS Job Failure</h3>
          <p>The daily subscription SMS reminder job ran on <strong>${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
          and found <strong>${candidatesDetected} candidates</strong> to notify, but sent <strong>0 messages</strong>
          (${failed} failed).</p>
          <p>Likely causes: SMS credits exhausted, ZSS gateway unreachable, or missing OMARISMS_* config.</p>
          <p>Check the server logs and top up credits at <a href="https://secure.zss.co.zw">secure.zss.co.zw</a> if needed.</p>
        </div>`,
      text: `SMS reminder job found ${candidatesDetected} candidates but sent 0 messages (${failed} failed). Check credits and gateway config.`,
    });
    console.log(`[Scheduler] SMS job failure alert sent to ${SMS_ALERT_RECIPIENTS.join(', ')}`);
  } catch (err: any) {
    console.error(`[Scheduler] Failed to send SMS job failure alert:`, err.message);
  }
}

async function runDailySubscriptionSmsReminders(): Promise<void> {
  console.log(`[Scheduler] Running subscription SMS reminders at ${new Date().toISOString()}`);

  const { executed, result, error } = await runSubscriptionSmsReminderJobWithLock();

  if (!executed) {
    console.log(`[Scheduler] Subscription SMS reminder job skipped - another instance is running`);
    return;
  }

  if (error) {
    console.error(`[Scheduler] Subscription SMS reminder job failed:`, error);
    return;
  }

  if (result) {
    console.log(`[Scheduler] Subscription SMS reminder job completed:`, {
      runDate:          result.runDate,
      candidates:       result.candidatesDetected,
      sent:             result.smsSentCount,
      failed:           result.smsFailedCount,
      skippedBalance:   result.sufficientBalanceSkipped,
      skippedDedup:     result.alreadySentSkipped,
      lane1:            result.lane1Count,
      lane2a:           result.lane2aCount,
    });

    // Alert if candidates were found but nothing was sent — likely gateway/credits issue
    if (result.candidatesDetected > 0 && result.smsSentCount === 0) {
      fireSmsJobFailureAlert(result.candidatesDetected, result.smsFailedCount).catch(() => {});
    }
  }
}

async function runDailySmsReconciliation(): Promise<void> {
  console.log(`[Scheduler] Running SMS reconciliation at ${new Date().toISOString()}`);

  const { executed, result, error } = await runSmsReconciliationJobWithLock();

  if (!executed) {
    console.log(`[Scheduler] SMS reconciliation job skipped - another instance is running`);
    return;
  }

  if (error) {
    console.error(`[Scheduler] SMS reconciliation job failed:`, error);
    return;
  }

  if (result) {
    console.log(`[Scheduler] SMS reconciliation job completed:`, {
      checked:   result.checkedCount,
      confirmed: result.confirmedCount,
      expired:   result.expiredCount,
      pending:   result.pendingCount,
    });
  }
}

async function runWeeklyWalletSnapshotFull(): Promise<void> {
  console.log(`[Scheduler] Running weekly wallet snapshot (full reset) at ${new Date().toISOString()}`);

  const { executed, result, error } = await runWalletSnapshotJobWithLock("full");

  if (!executed) {
    console.log(`[Scheduler] Wallet snapshot full job skipped - another instance is running`);
    return;
  }

  if (error) {
    console.error(`[Scheduler] Wallet snapshot full job failed:`, error);
    return;
  }

  if (result) {
    console.log(`[Scheduler] Wallet snapshot full job completed:`, {
      mode: result.mode,
      customers: result.customerCount,
      durationMs: result.durationMs,
      refreshedAt: result.refreshedAt,
    });
  }
}

// ============================================================================
// Scheduler Management
// ============================================================================

/**
 * Initialize and start all scheduled jobs.
 */
export function startScheduler(): void {
  console.log(`[Scheduler] Starting job scheduler...`);

  // Daily Alert Evaluator
  const alertTask = cron.schedule(DAILY_ALERT_CRON, runDailyAlerts, { timezone: CRON_TZ });

  scheduledJobs.push({
    name: "daily-alert-evaluator",
    cronExpression: DAILY_ALERT_CRON,
    task: alertTask,
  });

  const reportTask = cron.schedule(DAILY_BRANCH_REPORT_CRON, runDailyBranchReports, { timezone: CRON_TZ });

  scheduledJobs.push({
    name: "daily-branch-report-emailer",
    cronExpression: DAILY_BRANCH_REPORT_CRON,
    task: reportTask,
  });

  const walletReportTask = cron.schedule(DAILY_WALLET_REPORT_CRON, runDailyWalletReports, { timezone: CRON_TZ });

  scheduledJobs.push({
    name: "daily-wallet-report-emailer",
    cronExpression: DAILY_WALLET_REPORT_CRON,
    task: walletReportTask,
  });

  const customReportTask = cron.schedule(CUSTOM_REPORT_CRON, runDailyCustomReports, { timezone: CRON_TZ });
  scheduledJobs.push({
    name: "custom-report-emailer",
    cronExpression: CUSTOM_REPORT_CRON,
    task: customReportTask,
  });

  const walletSnapshotDailyTask = cron.schedule(WALLET_SNAPSHOT_INCREMENTAL_CRON, runDailyWalletSnapshotIncremental, { timezone: CRON_TZ });
  scheduledJobs.push({
    name: "wallet-customer-snapshot-incremental",
    cronExpression: WALLET_SNAPSHOT_INCREMENTAL_CRON,
    task: walletSnapshotDailyTask,
  });

  const walletSnapshotFullTask = cron.schedule(WALLET_SNAPSHOT_FULL_CRON, runWeeklyWalletSnapshotFull, { timezone: CRON_TZ });
  scheduledJobs.push({
    name: "wallet-customer-snapshot-full",
    cronExpression: WALLET_SNAPSHOT_FULL_CRON,
    task: walletSnapshotFullTask,
  });

  const subscriptionSmsTask = cron.schedule(SUBSCRIPTION_SMS_REMINDER_CRON, runDailySubscriptionSmsReminders, { timezone: CRON_TZ });
  scheduledJobs.push({
    name: "subscription-sms-reminder",
    cronExpression: SUBSCRIPTION_SMS_REMINDER_CRON,
    task: subscriptionSmsTask,
  });

  const subscriptionSmsReconTask = cron.schedule(SUBSCRIPTION_SMS_RECON_CRON, runDailySmsReconciliation, { timezone: CRON_TZ });
  scheduledJobs.push({
    name: "subscription-sms-reconciliation",
    cronExpression: SUBSCRIPTION_SMS_RECON_CRON,
    task: subscriptionSmsReconTask,
  });

  if (shouldEnableSourceMetricsSync()) {
    const sourceMetricsTask = cron.schedule(
      SOURCE_METRICS_SYNC_CRON,
      runDailySourceMetricsSync,
      { timezone: CRON_TZ },
    );

    scheduledJobs.push({
      name: "source-metrics-sync",
      cronExpression: SOURCE_METRICS_SYNC_CRON,
      task: sourceMetricsTask,
    });
  } else {
    console.log(
      `[Scheduler] Source metrics sync job is disabled or not configured`,
    );
  }

  console.log(`[Scheduler] Scheduled jobs:`);
  for (const job of scheduledJobs) {
    console.log(`  - ${job.name}: ${job.cronExpression}`);
  }

  // Catchup: if we started after the SMS window (09:00 Harare) and nothing was sent today, run now
  catchupSmsIfMissed().catch((err) =>
    console.error(`[Scheduler] SMS catchup check failed:`, err?.message ?? err),
  );
}

async function catchupSmsIfMissed(): Promise<void> {
  const nowHarare = new Date(new Date().toLocaleString('en-US', { timeZone: CRON_TZ }));
  const hourHarare = nowHarare.getHours();

  // Only catchup within the business window 09:00–15:59 Harare.
  // Before 09:00 → the cron will fire at 09:00 as normal.
  // 16:00 or later → too late, skip today entirely.
  if (hourHarare < 9) {
    console.log(`[Scheduler] SMS catchup: before 09:00 Harare — cron will handle it`);
    return;
  }
  if (hourHarare >= 16) {
    console.log(`[Scheduler] SMS catchup: past 16:00 Harare — skipping today`);
    return;
  }

  const todayStart = new Date(nowHarare);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(nowHarare);
  todayEnd.setHours(23, 59, 59, 999);

  const sentToday = await prisma.subscriptionSmsLog.count({
    where: { sentAt: { gte: todayStart, lte: todayEnd } },
  });

  if (sentToday > 0) {
    console.log(`[Scheduler] SMS catchup: ${sentToday} already sent today — no catchup needed`);
    return;
  }

  console.log(`[Scheduler] SMS catchup: no SMS sent today and time is ${hourHarare}:xx Harare — running now`);
  await runDailySubscriptionSmsReminders();
}

/**
 * Stop all scheduled jobs.
 */
export function stopScheduler(): void {
  console.log(`[Scheduler] Stopping job scheduler...`);

  for (const job of scheduledJobs) {
    job.task.stop();
    console.log(`  - Stopped: ${job.name}`);
  }

  scheduledJobs.length = 0;
}

/**
 * Manually trigger the alert evaluator job (for testing/admin).
 */
export async function triggerAlertJobManually(): Promise<{
  executed: boolean;
  result?: any;
  error?: Error;
}> {
  console.log(`[Scheduler] Manually triggering alert evaluator`);
  return runAlertEvaluatorJobWithLock();
}

export async function triggerDailyBranchReportJobManually(): Promise<{
  executed: boolean;
  result?: any;
  error?: Error;
}> {
  console.log(`[Scheduler] Manually triggering daily branch report emailer`);
  return runDailyBranchReportJobWithLock();
}

export async function triggerSubscriptionSmsJobManually(): Promise<{
  executed: boolean;
  result?: any;
  error?: Error;
}> {
  return runSubscriptionSmsReminderJobWithLock();
}

export async function triggerDailyWalletReportJobManually(): Promise<{
  executed: boolean;
  result?: any;
  error?: Error;
}> {
  console.log(`[Scheduler] Manually triggering daily wallet report emailer`);
  return runDailyWalletReportJobWithLock();
}

/**
 * Get the list of scheduled jobs.
 */
export function getScheduledJobs(): Array<{ name: string; cronExpression: string }> {
  return scheduledJobs.map((job) => ({
    name: job.name,
    cronExpression: job.cronExpression,
  }));
}
