import { api } from "./api";
import type {
  ApiDataResponse,
  ApiItemsResponse,
  CreateRecipientInput,
  Recipient,
  UpdateRecipientInput,
} from "../types/api";

export async function listRecipients(): Promise<Recipient[]> {
  const { data } = await api.get<ApiItemsResponse<Recipient>>("/api/recipients");
  return data.items;
}

export async function createRecipient(input: CreateRecipientInput): Promise<Recipient> {
  const { data } = await api.post<ApiDataResponse<Recipient>>("/api/recipients", input);
  return data.data;
}

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

export async function deleteRecipient(recipientId: string): Promise<void> {
  await api.delete(`/api/recipients/${recipientId}`);
}
