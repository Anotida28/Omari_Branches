import { api } from "./api";

// ── Response types (mirror backend) ───────────────────────────────────────

export interface FlocashKpis {
  totalCustomers: number;
  totalVolume: number;
  successfulTxns: number;
  failedTxns: number;
  failRate: number;
  flocashOnly: number;
  flocashOnlyPct: number;
}

export interface FlocashOverlap {
  flocashTotal: number;
  starlinkTotal: number;
  both: number;
  flocashOnly: number;
  starlinkOnly: number;
}

export interface RegularityBand {
  band: string;
  customerCount: number;
  avgMonthly: number;
  avgAnnual: number;
}

export interface MonthlyTrendPoint {
  yearMonth: number;
  label: string;
  txnCount: number;
  customerCount: number;
  totalUsd: number;
}

export interface TierClusterPoint {
  tier: string;
  sortOrder: number;
  h1TxnCount: number;
  h2TxnCount: number;
}

export interface CohortBand {
  band: string;
  customerCount: number;
  avgMonthly: number;
}

export interface FlocashReseller {
  accountId: string;
  mobileNr: string | null;
  firstName: string | null;
  lastName: string | null;
  activeMonths: number;
  avgMonthlyPayment: number;
  peakMonthPayment: number;
  totalPaidYr: number;
  successfulTxns: number;
  failedTxns: number;
}

export interface FlocashAnalytics {
  generatedAt: string;
  queryMs: number;
  kpis: FlocashKpis;
  overlap: FlocashOverlap;
  regularity: RegularityBand[];
  monthlyTrend: MonthlyTrendPoint[];
  tierClustering: TierClusterPoint[];
  cohort10to12: CohortBand[];
  resellers: FlocashReseller[];
}

export interface ResellerMonthPoint {
  yearMonth: number;
  label: string;
  successfulTxns: number;
  failedTxns: number;
  totalAmountPaid: number;
}

export interface ResellerMonthlyDetail {
  accountId: string;
  months: ResellerMonthPoint[];
}

// ── API calls ─────────────────────────────────────────────────────────────

export async function fetchFlocashAnalytics(forceRefresh = false): Promise<FlocashAnalytics> {
  const { data } = await api.get<FlocashAnalytics>("/api/flocash/analytics", {
    params: forceRefresh ? { refresh: "true" } : {},
    timeout: 700_000, // 11 min — heavy source DB scan, cached after first run
  });
  return data;
}

export async function fetchResellerDetail(accountId: string): Promise<ResellerMonthlyDetail> {
  const { data } = await api.get<ResellerMonthlyDetail>(
    `/api/flocash/reseller/${encodeURIComponent(accountId)}/detail`,
    { timeout: 60_000 },
  );
  return data;
}
