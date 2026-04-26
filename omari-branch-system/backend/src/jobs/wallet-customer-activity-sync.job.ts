import { withLock } from "../services/job-lock.service";
import {
  syncWalletCustomerActivitySnapshot,
  type WalletCustomerActivitySyncResult,
} from "../services/wallet-customer-activity.service";
import { isSourceMetricsConfigured } from "../services/source-agent-metrics.service";

const JOB_NAME = "wallet-customer-activity-sync";
const JOB_LOCK_DURATION_MS = 45 * 60 * 1000;

export function shouldEnableWalletCustomerActivitySync(): boolean {
  return isSourceMetricsConfigured();
}

export async function runWalletCustomerActivitySyncJob(
  asOfDate?: Date,
): Promise<WalletCustomerActivitySyncResult> {
  if (!isSourceMetricsConfigured()) {
    throw new Error("Source SQL metrics connection is not configured.");
  }

  return syncWalletCustomerActivitySnapshot(asOfDate ?? new Date());
}

export async function runWalletCustomerActivitySyncJobWithLock(
  asOfDate?: Date,
): Promise<{
  executed: boolean;
  result?: WalletCustomerActivitySyncResult;
  error?: Error;
}> {
  return withLock(
    JOB_NAME,
    () => runWalletCustomerActivitySyncJob(asOfDate),
    JOB_LOCK_DURATION_MS,
  );
}
