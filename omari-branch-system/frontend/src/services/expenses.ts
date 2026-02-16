import { api } from "./api";
import type {
  ApiDataResponse,
  CreateDocumentInput,
  CreateExpenseInput,
  CreatePaymentInput,
  CreatePaymentResponse,
  DocumentRecord,
  Expense,
  ExpenseDetail,
  ExpensesListParams,
  PaginatedResponse,
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

export async function createPayment(
  expenseId: string,
  input: CreatePaymentInput,
): Promise<CreatePaymentResponse> {
  const { data } = await api.post<CreatePaymentResponse>(
    `/api/expenses/${expenseId}/payments`,
    input,
  );
  return data;
}

export async function createDocument(
  input: CreateDocumentInput,
): Promise<DocumentRecord> {
  const { data } = await api.post<ApiDataResponse<DocumentRecord>>(
    "/api/documents",
    input,
  );
  return data.data;
}
