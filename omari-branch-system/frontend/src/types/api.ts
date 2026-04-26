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

export type UserRole = "VIEWER" | "FULL_ACCESS" | "SUPER_ADMIN";

export type AuthUser = {
  id: string;
  username: string;
  role: UserRole;
};

export type AuthLoginApiResponse = {
  status: string;
  message: string;
  accessToken: string;
  tokenType: string;
  user: {
    username: string;
    role: UserRole;
    lastLogin: string;
  };
};

export function isUserRole(value: unknown): value is UserRole {
  return value === "VIEWER" || value === "FULL_ACCESS" || value === "SUPER_ADMIN";
}

export function canRoleWrite(role: UserRole | null | undefined): boolean {
  return role === "FULL_ACCESS" || role === "SUPER_ADMIN";
}

export type Branch = {
  id: string;
  city: string;
  label: string;
  address: string | null;
  isActive: boolean;
  agentLines: Array<{
    id: string;
    lineNumber: string;
    isActive: boolean;
  }>;
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
  agentLineNumbers?: string[];
};

export type UpdateBranchInput = Partial<CreateBranchInput>;

export type SourceAgentReference = {
  lineNumber: string;
  agentAccount: string;
  customerId: string | null;
  fullName: string | null;
  mobileNumber: string | null;
};

export type BranchAgentLineValidationStatus =
  | "available"
  | "already_assigned"
  | "not_found"
  | "unverified";

export type BranchAgentLineValidation = {
  lineNumber: string;
  isAvailable: boolean;
  status: BranchAgentLineValidationStatus;
  message: string;
  conflictingBranchName: string | null;
  sourceAgent: SourceAgentReference | null;
};

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
  totalTransactionVolume: number;
  totalTransactionValue: string;
  commissionOnDeposits: string;
  commissionOnWithdrawals: string;
  totalCommission: string;
  netCashValue: string;
  netCashVolume: number;
  sourceLineCount: number;
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

export type Expense = {
  id: string;
  branchId: string;
  expenseType: ExpenseType;
  period: string;
  dueDate: string;
  amount: string;
  currency: string;
  vendor: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExpenseDetail = Expense;

export type ExpensesListParams = {
  branchId?: string;
  expenseType?: ExpenseType;
  period?: string;
  dueFrom?: string;
  dueTo?: string;
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

export type UpdateExpenseInput = {
  expenseType?: ExpenseType;
  period?: string;
  dueDate?: string;
  amount?: number;
  currency?: string;
  vendor?: string;
  notes?: string;
};

export type DashboardStats = {
  totalBranches: number;
  totalExpenses: number;
  totalReminderAmount: number;
  latestTotalEFloat: number;
  latestMetricDate: string | null;
};

export type DashboardRankingItem = {
  branchId: string;
  branchName: string;
  city: string;
  metricValue: number;
  secondaryValue: number;
};

export type DashboardOverview = DashboardStats & {
  leaders: {
    byPerformance: DashboardRankingItem[];
    byEFloat: DashboardRankingItem[];
  };
};

// ============================================================================
// Recipients
// ============================================================================

export type Recipient = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateRecipientInput = {
  email: string;
  name?: string;
  isActive?: boolean;
};

export type UpdateRecipientInput = {
  email?: string;
  name?: string;
  isActive?: boolean;
};

// ============================================================================
// Alert Logs
// ============================================================================

export type AlertRuleType = "DUE_REMINDER" | "OVERDUE_ESCALATION";
export type AlertSendStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED";

export type AlertLogBranchSummary = {
  id: string;
  displayName: string;
  city: string;
  label: string;
};

export type AlertLogExpenseSummary = {
  id: string;
  expenseType: string;
  period: string;
  dueDate: string;
  amount: string;
};

export type AlertLogRuleSummary = {
  ruleType: AlertRuleType;
  dayOffset: number;
  description: string;
};

export type AlertLog = {
  id: string;
  expenseId: string;
  branch: AlertLogBranchSummary;
  expense: AlertLogExpenseSummary;
  rule: AlertLogRuleSummary;
  sentTo: string;
  sentAt: string;
  status: AlertSendStatus;
  errorMessage: string | null;
};

export type AlertLogsListParams = {
  branchId?: string;
  expenseId?: string;
  ruleType?: AlertRuleType;
  status?: AlertSendStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

export type AlertStats = {
  totalSent: number;
  totalFailed: number;
  sentToday: number;
  sentThisWeek: number;
};

