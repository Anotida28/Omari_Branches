import { withLock } from "../services/job-lock.service";
import {
  syncWalletCustomerSnapshot,
  type WalletSnapshotSyncResult,
} from "../services/wallet-snapshot-sync.service";

const JOB_NAME = "wallet-customer-snapshot";
const JOB_LOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour — full sync can take a while

export async function runWalletSnapshotJob(mode: "full" | "incremental" = "incremental"): Promise<WalletSnapshotSyncResult> {
  return syncWalletCustomerSnapshot(mode);
}

export async function runWalletSnapshotJobWithLock(mode: "full" | "incremental" = "incremental"): Promise<{
  executed: boolean;
  result?: WalletSnapshotSyncResult;
  error?: Error;
}> {
  return withLock(JOB_NAME, () => runWalletSnapshotJob(mode), JOB_LOCK_DURATION_MS);
}
