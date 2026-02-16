export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type ApiDataResponse<T> = {
  data: T;
};

export type ApiItemsResponse<T> = {
  items: T[];
};

export type ExpenseType = "RENT" | "ZESA" | "WIFI" | "OTHER";
export type ExpenseStatus = "PENDING" | "PAID" | "OVERDUE";
export type DocumentType = "INVOICE" | "RECEIPT" | "OTHER";

export type Branch = {
  id: string;
  city: string;
  label: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  displayName: string;
};

export type BranchListParams = {
  search?: string;
  page?: number;
  pageSize?: number;
};

export type CreateBranchInput = {
  city: string;
  label: string;
  address?: string;
  isActive?: boolean;
};

export type UpdateBranchInput = Partial<CreateBranchInput>;

export type BranchMetric = {
  id: string;
  branchId: string;
  date: string;
  cashBalance: string;
  eFloatBalance: string;
  cashInVault: string;
  cashOnBranch: string;
  cashInVolume: number;
  cashInValue: string;
  cashOutVolume: number;
  cashOutValue: string;
  netCashValue: string;
  netCashVolume: number;
  createdAt: string;
  updatedAt: string;
};

export type MetricsListParams = {
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type UpsertMetricInput = {
  branchId: string;
  date: string;
  cashBalance: number;
  eFloatBalance: number;
  cashInVault: number;
  cashInVolume: number;
  cashInValue: number;
  cashOutVolume: number;
  cashOutValue: number;
};

export type Expense = {
  id: string;
  branchId: string;
  expenseType: ExpenseType;
  period: string;
  dueDate: string;
  amount: string;
  currency: string;
  status: ExpenseStatus;
  vendor: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  totalPaid: string;
  balanceRemaining: string;
  isOverdue: boolean;
};

export type Payment = {
  id: string;
  expenseId: string;
  paidDate: string;
  amountPaid: string;
  currency: string;
  reference: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type DocumentRecord = {
  id: string;
  docType: DocumentType;
  fileName: string;
  mimeType: string | null;
  sizeBytes: string | null;
  storageKey: string;
  expenseId: string | null;
  paymentId: string | null;
  metricId?: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
};

export type ExpenseDetail = Expense & {
  payments: Payment[];
  documents: DocumentRecord[];
};

export type ExpensesListParams = {
  branchId?: string;
  status?: ExpenseStatus;
  period?: string;
  page?: number;
  pageSize?: number;
};

export type CreateExpenseInput = {
  branchId: string;
  expenseType: ExpenseType;
  period: string;
  dueDate: string;
  amount: number;
  currency?: string;
  vendor?: string;
  notes?: string;
  createdBy?: string;
};

export type CreatePaymentInput = {
  paidDate: string;
  amountPaid: number;
  currency?: string;
  reference?: string;
  notes?: string;
  createdBy?: string;
};

export type CreateDocumentInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey?: string;
  url?: string;
  uploadedBy?: string;
  docType?: DocumentType;
  expenseId?: string;
  paymentId?: string;
  metricId?: string;
};

export type CreatePaymentResponse = {
  data: Payment;
  expense: Expense;
};

export type DashboardStats = {
  totalBranches: number;
  totalExpenses: number;
  overdueExpenses: number;
  totalOutstandingBalance: number;
};
