import { withLock } from '../services/job-lock.service';
import {
  runSubscriptionSmsReminders,
  type SubscriptionReminderResult,
} from '../services/subscription-sms-reminder.service';

const JOB_NAME             = 'subscription-sms-reminder';
const JOB_LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

export async function runSubscriptionSmsReminderJob(): Promise<SubscriptionReminderResult> {
  return runSubscriptionSmsReminders();
}

export async function runSubscriptionSmsReminderJobWithLock(): Promise<{
  executed: boolean;
  result?: SubscriptionReminderResult;
  error?: Error;
}> {
  return withLock(JOB_NAME, runSubscriptionSmsReminderJob, JOB_LOCK_DURATION_MS);
}
