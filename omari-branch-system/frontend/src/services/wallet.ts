import { api } from "./api";
import type { ApiDataResponse, WalletOverviewParams, WalletOverviewResponse } from "../types/api";

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
