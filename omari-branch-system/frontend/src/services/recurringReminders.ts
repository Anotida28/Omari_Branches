import { api } from "./api";
import type {
  ApiDataResponse,
  CreateRecurringReminderInput,
  PaginatedResponse,
  RecurringReminder,
  RecurringReminderDetail,
  RecurringReminderListParams,
  UpdateRecurringReminderInput,
} from "../types/api";

export async function listRecurringReminders(
  params: RecurringReminderListParams,
): Promise<PaginatedResponse<RecurringReminder>> {
  const { data } = await api.get<PaginatedResponse<RecurringReminder>>(
    "/api/recurring-reminders",
    { params },
  );
  return data;
}

export async function getRecurringReminderById(id: string): Promise<RecurringReminderDetail> {
  const { data } = await api.get<ApiDataResponse<RecurringReminderDetail>>(
    `/api/recurring-reminders/${id}`,
  );
  return data.data;
}

export async function createRecurringReminder(
  input: CreateRecurringReminderInput,
): Promise<RecurringReminder> {
  const { data } = await api.post<ApiDataResponse<RecurringReminder>>(
    "/api/recurring-reminders",
    input,
  );
  return data.data;
}

export async function updateRecurringReminder(
  id: string,
  input: UpdateRecurringReminderInput,
): Promise<RecurringReminder> {
  const { data } = await api.patch<ApiDataResponse<RecurringReminder>>(
    `/api/recurring-reminders/${id}`,
    input,
  );
  return data.data;
}

export async function deleteRecurringReminder(id: string): Promise<void> {
  await api.delete(`/api/recurring-reminders/${id}`);
}
