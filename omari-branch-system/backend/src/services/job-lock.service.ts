import { Prisma } from "@prisma/client";

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

function buildLockExpiry(lockDurationMs: number): Date {
  return new Date(Date.now() + lockDurationMs);
}

function getPrismaErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return null;
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
  const workerId = getWorkerId();
  const lockedUntil = buildLockExpiry(safeLockDurationMs);

  try {
    await prisma.jobLock.create({
      data: {
        jobName,
        lockedBy: workerId,
        lockedUntil,
      },
    });

    return {
      jobName,
      lockedBy: workerId,
      lockDurationMs: safeLockDurationMs,
    };
  } catch (error) {
    if (getPrismaErrorCode(error) !== "P2002") {
      throw error;
    }

    const now = new Date();
    const updated = await prisma.jobLock.updateMany({
      where: {
        jobName,
        lockedUntil: {
          lte: now,
        },
      },
      data: {
        lockedBy: workerId,
        lockedUntil,
      },
    });

    if (updated.count > 0) {
      return {
        jobName,
        lockedBy: workerId,
        lockDurationMs: safeLockDurationMs,
      };
    }

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
    const updated = await prisma.jobLock.updateMany({
      where: {
        jobName,
        lockedBy,
      },
      data: {
        lockedUntil: new Date(0),
      },
    });
    return updated.count > 0;
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

  try {
    const updated = await prisma.jobLock.updateMany({
      where: {
        jobName,
        lockedBy,
        lockedUntil: {
          gte: new Date(),
        },
      },
      data: {
        lockedUntil: buildLockExpiry(safeLockDurationMs),
      },
    });
    return updated.count > 0;
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
