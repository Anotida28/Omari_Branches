import { api } from "./api";
import type { DashboardOverview } from "../types/api";

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const { data } = await api.get<{ data: DashboardOverview }>("/api/dashboard/overview");
  return data.data;
}
