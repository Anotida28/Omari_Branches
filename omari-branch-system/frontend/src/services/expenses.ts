import { api } from "./api";
import type {
  ApiDataResponse,
  CreateExpenseInput,
  Expense,
  ExpenseDetail,
  ExpensesListParams,
  PaginatedResponse,
  UpdateExpenseInput,
} from "../types/api";

export async function listExpenses(
  params: ExpensesListParams,
): Promise<PaginatedResponse<Expense>> {
  const { data } = await api.get<PaginatedResponse<Expense>>("/api/expenses", {
    params,
  });
  return data;
}

export async function getExpenseById(expenseId: string): Promise<ExpenseDetail> {
  const { data } = await api.get<ApiDataResponse<ExpenseDetail>>(
    `/api/expenses/${expenseId}`,
  );
  return data.data;
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  const { data } = await api.post<ApiDataResponse<Expense>>("/api/expenses", input);
  return data.data;
}

export async function updateExpense(
  expenseId: string,
  input: UpdateExpenseInput,
): Promise<Expense> {
  const { data } = await api.patch<ApiDataResponse<Expense>>(
    `/api/expenses/${expenseId}`,
    input,
  );
  return data.data;
}

export async function deleteExpense(expenseId: string): Promise<void> {
  await api.delete(`/api/expenses/${expenseId}`);
}
