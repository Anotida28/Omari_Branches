import { api } from "./api";
import type {
  ApiDataResponse,
  BranchAgentLineValidation,
  Branch,
  BranchListParams,
  CreateBranchInput,
  PaginatedResponse,
  UpdateBranchInput,
} from "../types/api";

export async function listBranches(
  params: BranchListParams,
): Promise<PaginatedResponse<Branch>> {
  const { data } = await api.get<PaginatedResponse<Branch>>("/api/branches", {
    params,
  });
  return data;
}

export async function createBranch(
  input: CreateBranchInput,
): Promise<Branch> {
  const { data } = await api.post<ApiDataResponse<Branch>>("/api/branches", input);
  return data.data;
}

export async function validateBranchAgentLine(
  lineNumber: string,
  branchId?: string,
): Promise<BranchAgentLineValidation> {
  const { data } = await api.get<ApiDataResponse<BranchAgentLineValidation>>(
    "/api/branches/validate-agent-line",
    {
      params: {
        lineNumber,
        branchId,
      },
    },
  );
  return data.data;
}

export async function updateBranch(
  branchId: string,
  input: UpdateBranchInput,
): Promise<Branch> {
  const { data } = await api.patch<ApiDataResponse<Branch>>(
    `/api/branches/${branchId}`,
    input,
  );
  return data.data;
}

export async function deleteBranch(branchId: string): Promise<void> {
  await api.delete(`/api/branches/${branchId}`);
}
