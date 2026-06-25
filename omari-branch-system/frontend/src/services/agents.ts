import { api } from "./api";
import type { AgentSearchResult, AgentTrendsData } from "../types/api";

export async function fetchAllAgents(): Promise<AgentSearchResult[]> {
  const { data } = await api.get<AgentSearchResult[]>("/api/agents/list");
  return data;
}

export async function searchAgents(q: string): Promise<AgentSearchResult[]> {
  const { data } = await api.get<AgentSearchResult[]>("/api/agents/search", { params: { q } });
  return data;
}

export async function fetchAgentTrends(params: {
  agentAccounts: string[];
  dateFrom: string;
  dateTo: string;
}): Promise<AgentTrendsData> {
  const { data } = await api.get<AgentTrendsData>("/api/agents/trends", {
    params: {
      agentAccounts: params.agentAccounts.join(","),
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    },
  });
  return data;
}
