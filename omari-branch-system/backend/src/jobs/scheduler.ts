/**
 * Job Scheduler
 *
 * Uses node-cron to schedule recurring jobs.
 * All jobs run with DB lock protection to prevent duplicate execution
 * when running multiple API instances.
 */

import cron from "node-cron";

import { runAlertEvaluatorJobWithLock } from "./alert-evaluator.job";

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
