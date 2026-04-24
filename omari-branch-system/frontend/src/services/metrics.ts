import { api } from "./api";
import type {
  BranchMetric,
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
