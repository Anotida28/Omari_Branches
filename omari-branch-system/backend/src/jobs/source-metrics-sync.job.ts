import { Prisma } from "@prisma/client";

import { env } from "../config/env";
import { withLock } from "../services/job-lock.service";
import {
  MetricSourceSyncError,
  syncSourceMetrics,
  type MetricSourceSyncParams,
  type MetricSourceSyncResult,
} from "../services/metrics-source-sync.service";
import { isSourceMetricsConfigured } from "../services/source-agent-metrics.service";

const JOB_NAME = "source-metrics-sync";
const JOB_LOCK_DURATION_MS = 30 * 60 * 1000;

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

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function shouldEnableSourceMetricsSync(): boolean {
  return env.SOURCE_SQL_SYNC_ENABLED && isSourceMetricsConfigured();
}

export function getDefaultSourceMetricsSyncWindow(): {
  dateFrom: Date;
  dateTo: Date;
} {
  const dateTo = startOfTodayUtc();
  const dateFrom = addDays(dateTo, -(env.SOURCE_SQL_SYNC_LOOKBACK_DAYS - 1));

  return {
    dateFrom,
    dateTo,
  };
}

export async function runSourceMetricsSyncJob(
  params: Partial<MetricSourceSyncParams> = {},
): Promise<MetricSourceSyncResult> {
  if (!isSourceMetricsConfigured()) {
    throw new MetricSourceSyncError(
      "Source SQL metrics sync is not configured.",
      503,
    );
  }

  const defaults = getDefaultSourceMetricsSyncWindow();

  return syncSourceMetrics({
    dateFrom: params.dateFrom ?? defaults.dateFrom,
    dateTo: params.dateTo ?? defaults.dateTo,
    branchId: params.branchId,
  });
}

export async function runSourceMetricsSyncJobWithLock(
  params: Partial<MetricSourceSyncParams> = {},
): Promise<{
  executed: boolean;
  result?: MetricSourceSyncResult;
  error?: Error;
}> {
  try {
    return await withLock(
      JOB_NAME,
      () => runSourceMetricsSyncJob(params),
      JOB_LOCK_DURATION_MS,
    );
  } catch (error) {
    if (getPrismaErrorCode(error) === "P2021") {
      throw new MetricSourceSyncError(
        "The app database schema is missing the job lock or branch metrics tables. Apply the backend schema before running source sync.",
        503,
      );
    }

    throw error;
  }
}
