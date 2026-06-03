/**
 * Job Scheduler
 *
 * Uses node-cron to schedule recurring jobs.
 * All jobs run with DB lock protection to prevent duplicate execution
 * when running multiple API instances.
 */

import cron from "node-cron";

import { env } from "../config/env";
import { runAlertEvaluatorJobWithLock } from "./alert-evaluator.job";
import { runDailyBranchReportJobWithLock } from "./daily-branch-report.job";
import { runDailyWalletReportJobWithLock } from "./wallet-report.job";
import {
  runSourceMetricsSyncJobWithLock,
  shouldEnableSourceMetricsSync,
} from "./source-metrics-sync.job";
import { runWalletSnapshotJobWithLock } from "./wallet-snapshot.job";

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

/**
 * Daily at 08:00 Africa/Harare (UTC+2)
 * Since node-cron uses system timezone, we run at 06:00 UTC = 08:00 Harare
 */
const DAILY_ALERT_CRON = "0 6 * * *";                // 06:00 UTC = 08:00 Harare (UTC+2)
const DAILY_BRANCH_REPORT_CRON = "0 6 * * *";        // 06:00 UTC = 08:00 Harare (UTC+2)
const DAILY_WALLET_REPORT_CRON = "0 6 * * *";        // 06:00 UTC = 08:00 Harare (UTC+2)
const WALLET_SNAPSHOT_CRON = "0 3 * * 0";            // 03:00 UTC Sunday = 05:00 Harare (weekly)
const SOURCE_METRICS_SYNC_CRON = env.SOURCE_SQL_SYNC_CRON;

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

async function runWeeklyWalletSnapshot(): Promise<void> {
  console.log(`[Scheduler] Running wallet customer snapshot sync at ${new Date().toISOString()}`);

  const { executed, result, error } = await runWalletSnapshotJobWithLock();

  if (!executed) {
    console.log(`[Scheduler] Wallet snapshot job skipped - another instance is running`);
    return;
  }

  if (error) {
    console.error(`[Scheduler] Wallet snapshot job failed:`, error);
    return;
  }

  if (result) {
    console.log(`[Scheduler] Wallet snapshot job completed:`, {
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
  const alertTask = cron.schedule(DAILY_ALERT_CRON, runDailyAlerts);

  scheduledJobs.push({
    name: "daily-alert-evaluator",
    cronExpression: DAILY_ALERT_CRON,
    task: alertTask,
  });

  const reportTask = cron.schedule(DAILY_BRANCH_REPORT_CRON, runDailyBranchReports);

  scheduledJobs.push({
    name: "daily-branch-report-emailer",
    cronExpression: DAILY_BRANCH_REPORT_CRON,
    task: reportTask,
  });

  const walletReportTask = cron.schedule(DAILY_WALLET_REPORT_CRON, runDailyWalletReports);

  scheduledJobs.push({
    name: "daily-wallet-report-emailer",
    cronExpression: DAILY_WALLET_REPORT_CRON,
    task: walletReportTask,
  });

  const walletSnapshotTask = cron.schedule(WALLET_SNAPSHOT_CRON, runWeeklyWalletSnapshot);
  scheduledJobs.push({
    name: "wallet-customer-snapshot",
    cronExpression: WALLET_SNAPSHOT_CRON,
    task: walletSnapshotTask,
  });

  if (shouldEnableSourceMetricsSync()) {
    const sourceMetricsTask = cron.schedule(
      SOURCE_METRICS_SYNC_CRON,
      runDailySourceMetricsSync,
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
