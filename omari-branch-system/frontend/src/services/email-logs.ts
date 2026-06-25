import { api } from "./api";
import type { EmailLog, EmailLogListParams, PaginatedResponse } from "../types/api";

export async function listEmailLogs(
  params: EmailLogListParams,
): Promise<PaginatedResponse<EmailLog>> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== "" && v !== undefined && v !== null) clean[k] = v;
  }
  const { data } = await api.get<PaginatedResponse<EmailLog>>("/api/emails/logs", { params: clean });
  return data;
}
