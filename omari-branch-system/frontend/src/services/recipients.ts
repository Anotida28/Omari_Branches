import { api } from "./api";
import type {
  ApiDataResponse,
  ApiItemsResponse,
  CreateRecipientInput,
  Recipient,
  UpdateRecipientInput,
} from "../types/api";

/**
 * List recipients for a branch
 */
export async function listRecipients(branchId: string): Promise<Recipient[]> {
  const { data } = await api.get<ApiItemsResponse<Recipient>>(
    `/api/branches/${branchId}/recipients`
  );
  return data.items;
}

/**
 * Create a recipient for a branch
 */
export async function createRecipient(
  branchId: string,
  input: CreateRecipientInput
): Promise<Recipient> {
  const { data } = await api.post<ApiDataResponse<Recipient>>(
    `/api/branches/${branchId}/recipients`,
    input
  );
  return data.data;
}

/**
 * Update a recipient
 */
export async function updateRecipient(
  recipientId: string,
  input: UpdateRecipientInput
): Promise<Recipient> {
  const { data } = await api.patch<ApiDataResponse<Recipient>>(
    `/api/recipients/${recipientId}`,
    input
  );
  return data.data;
}

/**
 * Delete a recipient
 */
export async function deleteRecipient(recipientId: string): Promise<void> {
  await api.delete(`/api/recipients/${recipientId}`);
}
