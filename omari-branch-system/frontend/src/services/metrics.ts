import { api } from "./api";
import type {
  ApiDataResponse,
  BranchMetric,
  MetricsListParams,
  PaginatedResponse,
  UpsertMetricInput,
} from "../types/api";

export async function listMetrics(
  params: MetricsListParams,
): Promise<PaginatedResponse<BranchMetric>> {
  const { data } = await api.get<PaginatedResponse<BranchMetric>>("/api/metrics", {
    params,
  });
  return data;
}

export async function upsertMetric(input: UpsertMetricInput): Promise<BranchMetric> {
  const { data } = await api.post<ApiDataResponse<BranchMetric>>(
    "/api/metrics/upsert",
    input,
  );
  return data.data;
}
