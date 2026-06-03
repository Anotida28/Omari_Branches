import { withLock } from "../services/job-lock.service";
import {
  syncWalletCustomerSnapshot,
  type WalletSnapshotSyncResult,
} from "../services/wallet-snapshot-sync.service";

const JOB_NAME = "wallet-customer-snapshot";
const JOB_LOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour — sync can take a while

export async function runWalletSnapshotJob(): Promise<WalletSnapshotSyncResult> {
  return syncWalletCustomerSnapshot();
}

export async function runWalletSnapshotJobWithLock(): Promise<{
  executed: boolean;
  result?: WalletSnapshotSyncResult;
  error?: Error;
}> {
  return withLock(JOB_NAME, runWalletSnapshotJob, JOB_LOCK_DURATION_MS);
}
