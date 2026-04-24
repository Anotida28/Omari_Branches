import { api } from "./api";
import type {
  AlertLog,
  AlertLogsListParams,
  AlertStats,
  PaginatedResponse,
} from "../types/api";

export async function listAlertLogs(
  params: AlertLogsListParams
): Promise<PaginatedResponse<AlertLog>> {
  const { data } = await api.get<PaginatedResponse<AlertLog>>(
    "/api/alerts/logs",
    { params }
  );
  return data;
}

export async function getAlertLogById(id: string): Promise<AlertLog> {
  const { data } = await api.get<AlertLog>(`/api/alerts/logs/${id}`);
  return data;
}

export async function getAlertStats(): Promise<AlertStats> {
  const { data } = await api.get<AlertStats>("/api/alerts/stats");
  return data;
}
