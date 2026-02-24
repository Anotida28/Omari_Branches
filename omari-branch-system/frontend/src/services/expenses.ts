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
  UploadDocumentInput,
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

export async function uploadDocument(input: UploadDocumentInput): Promise<DocumentRecord> {
  const formData = new FormData();
  formData.append("file", input.file);

  if (input.docType) {
    formData.append("docType", input.docType);
  }
  if (input.uploadedBy) {
    formData.append("uploadedBy", input.uploadedBy);
  }
  if (input.expenseId) {
    formData.append("expenseId", input.expenseId);
  }
  if (input.paymentId) {
    formData.append("paymentId", input.paymentId);
  }
  if (input.metricId) {
    formData.append("metricId", input.metricId);
  }

  const { data } = await api.post<ApiDataResponse<DocumentRecord>>(
    "/api/documents/upload",
    formData,
  );
  return data.data;
}

export async function deleteDocumentById(documentId: string): Promise<void> {
  await api.delete(`/api/documents/${documentId}`);
}
