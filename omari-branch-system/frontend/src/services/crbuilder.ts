import { api } from "./api";

// ── Filter types ──────────────────────────────────────────────────────────

export const TRANSACTION_TYPES = [
  "All",
  "Account Bundle",
  "Airtime Purchase",
  "B2W Credit",
  "BillPayment",
  "Bundle Purchase",
  "Balance Inquiry",
  "Cash In debit",
  "Cash In credit",
  "Cash in for other debit",
  "Mama Money Agent Credit",
  "Merchant Purchase",
  "Purchase",
  "Remittances",
  "SendToCell Send",
  "Transfer-Send-Omari",
  "VISA",
  "Withdrawal (CashOut)",
  "ZIPIT-Receive",
  "ZIPIT-Send",
] as const;

export const VISA_SUBTYPES = [
  "VISA Purchase Completion",
  "VISA Online International Purchase",
  "VISA POS International Purchase",
  "VISA POS Domestic Purchase",
  "VISA ATM International Withdrawal",
  "VISA ATM Domestic Withdrawal",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type VisaSubtype = (typeof VISA_SUBTYPES)[number];

export interface CRBFilters {
  transactionTypes: string[];
  networkProviders: string[];
  bundleProviders: string[];
  remittanceProviders: string[];
  visaMerchants: string[];
  visaSubTypes: string[];
  terminalType: "All" | "POS" | "ATM" | "Online";
  dateRange: "day" | "week" | "month" | "custom";
  currency: "USD" | "ZWL" | "All";
  fromDate: string;
  toDate: string;
  amountFilter: "none" | "greater" | "less" | "equal";
  amountValue: string;
}

export const DEFAULT_FILTERS: CRBFilters = {
  transactionTypes: [],
  networkProviders: [],
  bundleProviders: [],
  remittanceProviders: [],
  visaMerchants: [],
  visaSubTypes: [],
  terminalType: "All",
  dateRange: "month",
  currency: "USD",
  fromDate: "",
  toDate: "",
  amountFilter: "none",
  amountValue: "",
};

// ── Response types ────────────────────────────────────────────────────────

export interface DailyRecord {
  Date: string;
  TransactionType: string;
  UniqueCustomers: number;
  TotalValue: number;
  TotalVolume: number;
  TotalFees: number;
  POS_Count?: number;
  Online_Count?: number;
  ATM_Count?: number;
  MerchantName?: string | null;
}

export interface MonthlyUniqueUser {
  MonthYear: string;
  TransactionType: string;
  MonthlyUniqueUsers: number;
}

export interface FilteredDataResponse {
  dailyData: DailyRecord[];
  totalUniqueUsers: { TotalUniqueUsers: number }[];
  monthlyComboUsers: Record<string, number>;
  totalComboUsers: number;
  monthlyUniqueUsers: MonthlyUniqueUser[];
}

export interface VisaMerchant {
  MerchantName: string;
  UniqueCustomers: number;
  TotalVolume: number;
  TotalValue: number;
  AvgTransactionValue: number;
  MinTransactionValue: number;
  MaxTransactionValue: number;
  TotalFees: number;
  AvgFee: number;
}

export interface VisaMerchantsResponse {
  merchants: VisaMerchant[];
  overallStats: {
    totalMerchants: number;
    totalAllMerchants: number;
    totalUniqueCustomers: number;
    totalVolume: number;
    totalValue: number;
    avgTransactionValue: number;
  };
  pagination: { currentPage: number; pageSize: number; totalCount: number; totalPages: number };
}

export interface VisaCombinedStatsResponse {
  totalUniqueCustomers: number;
  totalValue: number;
  totalVolume: number;
  totalFees: number;
  overlapAnalysis: { overlappingCustomers: number; overlapPercentage: number };
}

export interface MerchantTransaction {
  AccountId: string;
  TransactionDate: string;
  TransactionAmount: number;
  NetFee: number;
  TaxFee: number;
  MerchantName: string;
}

export interface VisaMerchantDetailsResponse {
  transactions: MerchantTransaction[];
  summary: {
    UniqueCustomers: number;
    TotalVolume: number;
    TotalValue: number;
    AvgTransactionValue: number;
    MinTransactionValue: number;
    MaxTransactionValue: number;
    TotalFees: number;
  };
  pagination: { currentPage: number; pageSize: number; totalCount: number; totalPages: number };
}

export interface AiResponse {
  message: string;
  query_type?: string;
  report_suggestions?: string[];
}

// ── API calls ─────────────────────────────────────────────────────────────

export async function fetchFilteredData(filters: CRBFilters): Promise<FilteredDataResponse> {
  const { data } = await api.post<FilteredDataResponse>("/api/crbuilder/filtered-data", filters, {
    timeout: 120_000,
  });
  return data;
}

export async function fetchVisaMerchants(params: {
  filters: CRBFilters;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: "ASC" | "DESC";
  searchTerm: string;
}): Promise<VisaMerchantsResponse> {
  const { data } = await api.post<VisaMerchantsResponse>("/api/crbuilder/visa-merchants", {
    dateRange: params.filters.dateRange,
    fromDate: params.filters.fromDate,
    toDate: params.filters.toDate,
    amountFilter: params.filters.amountFilter,
    amountValue: params.filters.amountValue,
    terminalType: params.filters.terminalType,
    visaSubTypes: params.filters.visaSubTypes,
    page: params.page,
    pageSize: params.pageSize,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
    searchTerm: params.searchTerm,
  });
  return data;
}

export async function fetchVisaCombinedStats(
  merchantNames: string[],
  filters: CRBFilters,
): Promise<VisaCombinedStatsResponse> {
  const { data } = await api.post<VisaCombinedStatsResponse>("/api/crbuilder/visa-combined-stats", {
    merchantNames,
    dateRange: filters.dateRange,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    amountFilter: filters.amountFilter,
    amountValue: filters.amountValue,
  });
  return data;
}

export async function fetchVisaMerchantDetails(params: {
  merchantName: string;
  filters: CRBFilters;
  page: number;
  pageSize: number;
}): Promise<VisaMerchantDetailsResponse> {
  const { data } = await api.post<VisaMerchantDetailsResponse>("/api/crbuilder/visa-merchant-details", {
    merchantName: params.merchantName,
    dateRange: params.filters.dateRange,
    fromDate: params.filters.fromDate,
    toDate: params.filters.toDate,
    amountFilter: params.filters.amountFilter,
    amountValue: params.filters.amountValue,
    terminalType: params.filters.terminalType,
    visaSubTypes: params.filters.visaSubTypes,
    page: params.page,
    pageSize: params.pageSize,
  });
  return data;
}

export async function fetchVisaMerchantDetailsExport(
  merchantName: string,
  filters: CRBFilters,
): Promise<{ transactions: MerchantTransaction[]; merchantName: string; summary: VisaMerchantDetailsResponse["summary"] }> {
  const { data } = await api.post("/api/crbuilder/visa-merchant-details-export", {
    merchantName,
    dateRange: filters.dateRange,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    amountFilter: filters.amountFilter,
    amountValue: filters.amountValue,
    terminalType: filters.terminalType,
    visaSubTypes: filters.visaSubTypes,
  }, { timeout: 300_000 });
  return data;
}

export async function fetchVisaExportSelectedCustomers(
  merchantNames: string[],
  filters: CRBFilters,
): Promise<{ transactions: MerchantTransaction[]; totalUniqueCustomers: number; totalValue: number; totalVolume: number }> {
  const { data } = await api.post("/api/crbuilder/visa-export-selected-customers", {
    merchantNames,
    dateRange: filters.dateRange,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    amountFilter: filters.amountFilter,
    amountValue: filters.amountValue,
    exportType: "detailed",
  }, { timeout: 300_000 });
  return data;
}

export async function fetchIndividualRecords(filters: CRBFilters): Promise<unknown[]> {
  const { data } = await api.post<unknown[]>("/api/crbuilder/individual-records", {
    ...filters,
    exportIndividual: true,
  }, { timeout: 300_000 });
  return data;
}

export async function fetchAiResponse(
  query: string,
  context: Record<string, unknown> = {},
): Promise<AiResponse> {
  const { data } = await api.post<AiResponse>("/api/crbuilder/ai", {
    query,
    conversation_id: "crbuilder-session",
    context,
  }, { timeout: 60_000 });
  return data;
}
