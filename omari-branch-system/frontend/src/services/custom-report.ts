import { api } from "./api";

export type SectionType =
  | "BRANCH_PERFORMANCE"
  | "TOP_PERFORMERS"
  | "WALLET_SUMMARY"
  | "WALLET_RETENTION"
  | "ALERTS_SUMMARY";

export type ReportSection = {
  id: string;
  type: SectionType;
  params: Record<string, unknown>;
};

export type ReportConfig = {
  isEnabled: boolean;
  deliveryEmail: string;
  sections: ReportSection[];
  branchIds: string[];
};

export async function fetchMyReportConfig(): Promise<ReportConfig | null> {
  const { data } = await api.get<{ data: ReportConfig | null }>("/api/my-report/config");
  return data.data;
}

export async function saveMyReportConfig(config: ReportConfig): Promise<ReportConfig> {
  const { data } = await api.put<{ data: ReportConfig }>("/api/my-report/config", config);
  return data.data;
}

export async function sendTestReport(): Promise<{ sentTo: string }> {
  const { data } = await api.post<{ ok: boolean; sentTo: string }>("/api/my-report/test-send");
  return data;
}
