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
import {
  runSourceMetricsSyncJobWithLock,
  shouldEnableSourceMetricsSync,
} from "./source-metrics-sync.job";
import {
  runWalletCustomerActivitySyncJobWithLock,
  shouldEnableWalletCustomerActivitySync,
} from "./wallet-customer-activity-sync.job";

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
const DAILY_ALERT_CRON = "0 6 * * *"; // 06:00 UTC = 08:00 Harare (UTC+2)
const SOURCE_METRICS_SYNC_CRON = env.SOURCE_SQL_SYNC_CRON;
const WALLET_CUSTOMER_ACTIVITY_SYNC_CRON = "45 7 * * *";

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

async function runDailyWalletCustomerActivitySync(): Promise<void> {
  console.log(
    `[Scheduler] Running wallet customer activity sync at ${new Date().toISOString()}`,
  );

  const { executed, result, error } =
    await runWalletCustomerActivitySyncJobWithLock();

  if (!executed) {
    console.log(
      `[Scheduler] Wallet customer activity sync skipped - another instance is running`,
    );
    return;
  }

  if (error) {
    console.error(
      `[Scheduler] Wallet customer activity sync failed with error:`,
      error,
    );
    return;
  }

  if (result) {
    console.log(`[Scheduler] Wallet customer activity sync completed:`, {
      asOfDate: result.asOfDate,
      customers: result.refreshedCustomerCount,
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

  if (shouldEnableWalletCustomerActivitySync()) {
    const walletCustomerActivityTask = cron.schedule(
      WALLET_CUSTOMER_ACTIVITY_SYNC_CRON,
      runDailyWalletCustomerActivitySync,
    );

    scheduledJobs.push({
      name: "wallet-customer-activity-sync",
      cronExpression: WALLET_CUSTOMER_ACTIVITY_SYNC_CRON,
      task: walletCustomerActivityTask,
    });
  } else {
    console.log(
      `[Scheduler] Wallet customer activity sync job is disabled or not configured`,
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

/**
 * Get the list of scheduled jobs.
 */
export function getScheduledJobs(): Array<{ name: string; cronExpression: string }> {
  return scheduledJobs.map((job) => ({
    name: job.name,
    cronExpression: job.cronExpression,
  }));
}
