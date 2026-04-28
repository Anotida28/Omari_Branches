import { api } from "./api";
import type {
  ApiDataResponse,
  WalletCustomer360DetailParams,
  WalletCustomer360DetailResponse,
  WalletCustomer360ListParams,
  WalletCustomer360ListResponse,
  WalletCustomerActivityGrowthResponse,
  WalletCustomerActivityParams,
  WalletLiquidityParams,
  WalletLiquidityResponse,
  WalletInsightsAlertsParams,
  WalletInsightsAlertsResponse,
  WalletOverviewParams,
  WalletOverviewResponse,
  WalletRetentionDormancyParams,
  WalletRetentionDormancyResponse,
  WalletRevenuePerformanceParams,
  WalletRevenuePerformanceResponse,
  WalletTransactionPerformanceParams,
  WalletTransactionPerformanceResponse,
  WalletVisaAnalyticsParams,
  WalletVisaAnalyticsResponse,
} from "../types/api";

export async function fetchWalletOverview(
  params: WalletOverviewParams,
): Promise<WalletOverviewResponse> {
  const { data } = await api.get<ApiDataResponse<WalletOverviewResponse>>("/api/wallet/overview", {
    params: {
      ...params,
      compare: params.compare === false ? "false" : "true",
    },
  });

  return data.data;
}

export async function fetchWalletCustomerActivityGrowth(
  params: WalletCustomerActivityParams,
): Promise<WalletCustomerActivityGrowthResponse> {
  const { data } = await api.get<ApiDataResponse<WalletCustomerActivityGrowthResponse>>(
    "/api/wallet/customer-activity",
    { params },
  );

  return data.data;
}

export async function fetchWalletRetentionDormancy(
  params: WalletRetentionDormancyParams,
): Promise<WalletRetentionDormancyResponse> {
  const { data } = await api.get<ApiDataResponse<WalletRetentionDormancyResponse>>(
    "/api/wallet/retention-dormancy",
    { params },
  );

  return data.data;
}

export async function fetchWalletTransactionPerformance(
  params: WalletTransactionPerformanceParams,
): Promise<WalletTransactionPerformanceResponse> {
  const { data } = await api.get<ApiDataResponse<WalletTransactionPerformanceResponse>>(
    "/api/wallet/transaction-performance",
    { params },
  );

  return data.data;
}

export async function fetchWalletRevenuePerformance(
  params: WalletRevenuePerformanceParams,
): Promise<WalletRevenuePerformanceResponse> {
  const { data } = await api.get<ApiDataResponse<WalletRevenuePerformanceResponse>>(
    "/api/wallet/revenue-performance",
    { params },
  );

  return data.data;
}

export async function fetchWalletLiquidity(
  params: WalletLiquidityParams,
): Promise<WalletLiquidityResponse> {
  const { data } = await api.get<ApiDataResponse<WalletLiquidityResponse>>(
    "/api/wallet/liquidity",
    { params },
  );

  return data.data;
}

export async function fetchWalletCustomer360List(
  params: WalletCustomer360ListParams,
): Promise<WalletCustomer360ListResponse> {
  const { data } = await api.get<ApiDataResponse<WalletCustomer360ListResponse>>(
    "/api/wallet/customer-360",
    { params },
  );

  return data.data;
}

export async function fetchWalletCustomer360Detail(
  params: WalletCustomer360DetailParams,
): Promise<WalletCustomer360DetailResponse> {
  const { customerId, ...queryParams } = params;
  const { data } = await api.get<ApiDataResponse<WalletCustomer360DetailResponse>>(
    `/api/wallet/customer-360/${encodeURIComponent(customerId)}`,
    { params: queryParams },
  );

  return data.data;
}

export async function fetchWalletInsightsAlerts(
  params: WalletInsightsAlertsParams,
): Promise<WalletInsightsAlertsResponse> {
  const { data } = await api.get<ApiDataResponse<WalletInsightsAlertsResponse>>(
    "/api/wallet/insights-alerts",
    { params },
  );

  return data.data;
}

export async function fetchWalletVisaAnalytics(
  params: WalletVisaAnalyticsParams,
): Promise<WalletVisaAnalyticsResponse> {
  const { data } = await api.get<ApiDataResponse<WalletVisaAnalyticsResponse>>(
    "/api/wallet/visa-analytics",
    { params },
  );

  return data.data;
}
