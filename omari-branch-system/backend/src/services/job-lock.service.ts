import { prisma } from "../db/prisma";

/**
 * Job lock service for preventing duplicate job executions across instances.
 * Uses database-level locking to ensure only one instance runs a job at a time.
 */

const DEFAULT_LOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

type AcquiredLock = {
  jobName: string;
  lockedBy: string;
  lockDurationMs: number;
};

/**
 * Generate a unique worker ID for this process instance.
 */
function getWorkerId(): string {
  return `worker-${process.pid}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function toSafeLockDurationMs(lockDurationMs: number): number {
  if (!Number.isFinite(lockDurationMs) || lockDurationMs <= 0) {
    return DEFAULT_LOCK_DURATION_MS;
  }
  return Math.floor(lockDurationMs);
}

/**
 * Attempt to acquire a lock for a job.
 * Returns lock details if acquired, null if another worker holds the lock.
 */
export async function acquireLock(
  jobName: string,
  lockDurationMs: number = DEFAULT_LOCK_DURATION_MS
): Promise<AcquiredLock | null> {
  const safeLockDurationMs = toSafeLockDurationMs(lockDurationMs);
  const lockDurationMicros = safeLockDurationMs * 1000;
  const workerId = getWorkerId();

  try {
    // Compare against database time (NOW) to avoid cross-instance clock skew.
    await prisma.$executeRaw`
      INSERT INTO JobLock (jobName, lockedUntil, lockedBy, createdAt, updatedAt)
      VALUES (
        ${jobName},
        TIMESTAMPADD(MICROSECOND, ${lockDurationMicros}, NOW(3)),
        ${workerId},
        NOW(3),
        NOW(3)
      )
      ON DUPLICATE KEY UPDATE
        lockedBy = IF(lockedUntil < NOW(3), ${workerId}, lockedBy),
        lockedUntil = IF(
          lockedUntil < NOW(3),
          TIMESTAMPADD(MICROSECOND, ${lockDurationMicros}, NOW(3)),
          lockedUntil
        ),
        updatedAt = IF(lockedUntil < NOW(3), NOW(3), updatedAt)
    `;

    // Now check if we actually hold the lock
    const lock = await prisma.jobLock.findUnique({
      where: { jobName },
    });

    if (lock && lock.lockedBy === workerId) {
      return {
        jobName,
        lockedBy: workerId,
        lockDurationMs: safeLockDurationMs,
      };
    }

    return null;
  } catch (error) {
    console.error(`[JobLock] Failed to acquire lock for ${jobName}:`, error);
    return null;
  }
}

/**
 * Release a lock for a job.
 * Only releases if the calling worker holds the lock.
 */
export async function releaseLock(
  jobName: string,
  lockedBy: string
): Promise<boolean> {
  try {
    const updated = await prisma.$executeRaw`
      UPDATE JobLock
      SET lockedUntil = FROM_UNIXTIME(0),
          updatedAt = NOW(3)
      WHERE jobName = ${jobName}
        AND lockedBy = ${lockedBy}
    `;
    return Number(updated) > 0;
  } catch (error) {
    console.warn(
      `[JobLock] Could not release lock for ${jobName} by ${lockedBy}:`,
      error
    );
    return false;
  }
}

/**
 * Renew a lock lease while a job is still running.
 * Succeeds only if the caller still owns the lock and it has not expired.
 */
export async function renewLock(
  jobName: string,
  lockedBy: string,
  lockDurationMs: number = DEFAULT_LOCK_DURATION_MS
): Promise<boolean> {
  const safeLockDurationMs = toSafeLockDurationMs(lockDurationMs);
  const lockDurationMicros = safeLockDurationMs * 1000;

  try {
    const updated = await prisma.$executeRaw`
      UPDATE JobLock
      SET lockedUntil = TIMESTAMPADD(MICROSECOND, ${lockDurationMicros}, NOW(3)),
          updatedAt = NOW(3)
      WHERE jobName = ${jobName}
        AND lockedBy = ${lockedBy}
        AND lockedUntil >= NOW(3)
    `;
    return Number(updated) > 0;
  } catch (error) {
    console.error(
      `[JobLock] Could not renew lock for ${jobName} by ${lockedBy}:`,
      error
    );
    return false;
  }
}

/**
 * Execute a job with lock protection.
 * Returns true if job was executed, false if lock was not acquired.
 */
export async function withLock<T>(
  jobName: string,
  fn: () => Promise<T>,
  lockDurationMs: number = DEFAULT_LOCK_DURATION_MS
): Promise<{ executed: boolean; result?: T; error?: Error }> {
  const safeLockDurationMs = toSafeLockDurationMs(lockDurationMs);
  const acquired = await acquireLock(jobName, safeLockDurationMs);

  if (!acquired) {
    console.log(`[JobLock] Could not acquire lock for ${jobName}, skipping execution`);
    return { executed: false };
  }

  const heartbeatIntervalMs = Math.max(
    1000,
    Math.floor(safeLockDurationMs / 3)
  );
  const heartbeat = setInterval(async () => {
    const renewed = await renewLock(
      acquired.jobName,
      acquired.lockedBy,
      acquired.lockDurationMs
    );
    if (!renewed) {
      console.error(
        `[JobLock] Failed to renew lock for ${acquired.jobName} by ${acquired.lockedBy}.`
      );
    }
  }, heartbeatIntervalMs);
  heartbeat.unref?.();

  console.log(
    `[JobLock] Acquired lock for ${jobName} as ${acquired.lockedBy} (lease=${safeLockDurationMs}ms, heartbeat=${heartbeatIntervalMs}ms)`
  );

  try {
    const result = await fn();
    return { executed: true, result };
  } catch (error) {
    console.error(`[JobLock] Error executing ${jobName}:`, error);
    return { executed: true, error: error as Error };
  } finally {
    clearInterval(heartbeat);
    const released = await releaseLock(acquired.jobName, acquired.lockedBy);
    if (!released) {
      console.warn(
        `[JobLock] Lock for ${acquired.jobName} was not released because ownership changed or lock expired.`
      );
    } else {
      console.log(
        `[JobLock] Released lock for ${acquired.jobName} by ${acquired.lockedBy}`
      );
    }
  }
}
