import { withLock } from '../services/job-lock.service';
import {
  runSmsReconciliation,
  type ReconciliationResult,
} from '../services/subscription-sms-reconciliation.service';

const JOB_NAME             = 'subscription-sms-reconciliation';
const JOB_LOCK_DURATION_MS = 20 * 60 * 1000; // 20 minutes

export async function runSmsReconciliationJob(): Promise<ReconciliationResult> {
  return runSmsReconciliation();
}

export async function runSmsReconciliationJobWithLock(): Promise<{
  executed: boolean;
  result?:  ReconciliationResult;
  error?:   Error;
}> {
  return withLock(JOB_NAME, runSmsReconciliationJob, JOB_LOCK_DURATION_MS);
}
