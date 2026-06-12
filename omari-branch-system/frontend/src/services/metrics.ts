import { api } from "./api";
import type {
  BranchMetric,
  MetricSyncParams,
  MetricSyncResult,
  MetricsListParams,
  PaginatedResponse,
} from "../types/api";

export async function listMetrics(
  params: MetricsListParams,
): Promise<PaginatedResponse<BranchMetric>> {
  const { data } = await api.get<PaginatedResponse<BranchMetric>>("/api/metrics", {
    params,
  });
  return data;
}

export async function syncMetrics(params: MetricSyncParams = {}): Promise<MetricSyncResult> {
  const { data } = await api.post<{ message: string; data: MetricSyncResult }>(
    "/api/metrics/sync",
    params,
    { timeout: 300_000 },
  );
  return data.data;
}
