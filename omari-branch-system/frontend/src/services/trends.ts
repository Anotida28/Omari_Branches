import { api } from "./api";

export type TrendsFilters = {
  branchId?: string;
  dateFrom: string;
  dateTo: string;
};

export type TrendsKpis = {
  latestTotalEFloat: number;
  totalTransactionValue: number;
  totalTransactionVolume: number;
  totalCommission: number;
};

export type CashTrendPoint = {
  date: string;
  eFloatBalance: number;
  cashInVolume: number;
  cashOutVolume: number;
  totalTransactionVolume: number;
  cashInValue: number;
  cashOutValue: number;
  totalTransactionValue: number;
  totalCommission: number;
  netCashValue: number;
};

export type BranchPerformancePoint = {
  branchId: string;
  branchName: string;
  latestEFloatBalance: number;
  totalTransactionValue: number;
  totalCommission: number;
};

export type TrendsData = {
  kpis: TrendsKpis;
  cashTrend: CashTrendPoint[];
  branchPerformance: BranchPerformancePoint[];
};

export async function fetchTrendsData(filters: TrendsFilters): Promise<TrendsData> {
  const { data } = await api.get<{ data: TrendsData }>("/api/trends/data", {
    params: {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    },
  });
  return data.data;
}
