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

export type WalletOverviewKpis = {
  totalTransactionValue: number;
  totalTransactionVolume: number;
  totalCommission: number;
  activeCustomersA30: number;
  activeCustomersA60: number;
  newCustomers: number;
  dormantCustomers90Plus: number | null;
  latestTotalEFloat: number;
  latestEFloatDate: string | null;
};

export type WalletComparisonKpi = {
  previousValue: number;
  absoluteChange: number;
  percentChange: number | null;
};

export type WalletOverviewResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
    asOfDate: string;
  };
  kpis: WalletOverviewKpis;
  comparison: {
    previousPeriodDateFrom: string;
    previousPeriodDateTo: string;
    kpis: {
      totalTransactionValue: WalletComparisonKpi;
      totalTransactionVolume: WalletComparisonKpi;
      totalCommission: WalletComparisonKpi;
      activeCustomersA30: WalletComparisonKpi;
      activeCustomersA60: WalletComparisonKpi;
      newCustomers: WalletComparisonKpi;
      dormantCustomers90Plus: WalletComparisonKpi | null;
      latestTotalEFloat: WalletComparisonKpi;
    };
  } | null;
  metadata: {
    currency: string;
    dataFreshnessTimestamp: string;
    sourceSummaryTable: string;
    sourceBalanceTable: string;
    sourceBalanceCurrentTable: string;
  };
};

export type WalletOverviewParams = {
  dateFrom: string;
  dateTo: string;
  asOfDate?: string;
  compare?: boolean;
  currency?: "USD" | "ZWL";
};

export type WalletCustomerActivityTrendPoint = {
  period: string;
  activeCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  transactionVolume: number;
};

export type WalletCustomerFrequencyBucket = {
  bucket: "1 tx" | "2-5 tx" | "6-20 tx" | "20+ tx";
  customers: number;
};

export type WalletCustomerActivityGrowthResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
  };
  kpis: {
    activeCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    transactionVolume: number;
    averageTransactionsPerActiveCustomer: number;
  };
  dailyTrend: WalletCustomerActivityTrendPoint[];
  monthlyTrend: WalletCustomerActivityTrendPoint[];
  frequencyBuckets: WalletCustomerFrequencyBucket[];
  metadata: {
    dataFreshnessTimestamp: string;
    sourceSummaryTable: string;
  };
};

export type WalletCustomerActivityParams = {
  dateFrom: string;
  dateTo: string;
  currency?: "USD" | "ZWL";
};

export type WalletInactivityBucket = {
  bucket: "0-7 days" | "8-30 days" | "31-60 days" | "61-90 days" | "90+ days";
  customers: number;
};

export type WalletReactivationTrendPoint = {
  period: string;
  reactivatedCustomers: number;
};

export type WalletRetentionCohort = {
  cohortMonth: string;
  customers: number;
  active30Customers: number;
  dormant90Customers: number;
  active30Rate: number;
  dormant90Rate: number;
};

export type WalletRetentionDormancyResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
    asOfDate: string;
  };
  kpis: {
    activeCustomersA30: number;
    dormantCustomers90Plus: number;
    dormancyRate: number;
    reactivatedCustomers: number;
  };
  inactivityBuckets: WalletInactivityBucket[];
  reactivationTrend: WalletReactivationTrendPoint[];
  cohorts: WalletRetentionCohort[];
  metadata: {
    dataFreshnessTimestamp: string;
  };
};

export type WalletRetentionDormancyParams = {
  dateFrom: string;
  dateTo: string;
  asOfDate?: string;
  currency?: "USD" | "ZWL";
};

export type WalletTransactionTrendPoint = {
  period: string;
  depositValue: number;
  withdrawalValue: number;
  netFlowValue: number;
  depositVolume: number;
  withdrawalVolume: number;
  totalTransactionValue: number;
  totalTransactionVolume: number;
  activeCustomers: number;
  valuePerActiveCustomer: number;
  volumePerActiveCustomer: number;
};

export type WalletTransactionPerformanceResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
  };
  kpis: {
    depositValue: number;
    withdrawalValue: number;
    netFlowValue: number;
    depositVolume: number;
    withdrawalVolume: number;
    totalTransactionValue: number;
    totalTransactionVolume: number;
    activeCustomers: number;
    valuePerActiveCustomer: number;
    volumePerActiveCustomer: number;
  };
  dailyTrend: WalletTransactionTrendPoint[];
  monthlyTrend: WalletTransactionTrendPoint[];
  metadata: {
    dataFreshnessTimestamp: string;
    sourceSummaryTable: string;
  };
};

export type WalletTransactionPerformanceParams = {
  dateFrom: string;
  dateTo: string;
  currency?: "USD" | "ZWL";
};

export type WalletRevenueTrendPoint = {
  period: string;
  totalCommission: number;
  depositCommission: number;
  withdrawalCommission: number;
  totalTransactionValue: number;
  totalTransactionVolume: number;
  activeCustomers: number;
  commissionPerTransaction: number;
  commissionPerActiveCustomer: number;
  commissionRate: number;
};

export type WalletRevenuePerformanceResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
  };
  kpis: {
    totalCommission: number;
    depositCommission: number;
    withdrawalCommission: number;
    totalTransactionValue: number;
    totalTransactionVolume: number;
    activeCustomers: number;
    commissionPerTransaction: number;
    commissionPerActiveCustomer: number;
    commissionRate: number;
  };
  dailyTrend: WalletRevenueTrendPoint[];
  monthlyTrend: WalletRevenueTrendPoint[];
  metadata: {
    dataFreshnessTimestamp: string;
    sourceSummaryTable: string;
  };
};

export type WalletRevenuePerformanceParams = {
  dateFrom: string;
  dateTo: string;
  currency?: "USD" | "ZWL";
};

export type WalletLiquidityTrendPoint = {
  period: string;
  totalEFloat: number;
  averageBalance: number;
  accountCount: number;
  lowBalanceAccounts: number;
  zeroOrNegativeAccounts: number;
};

export type WalletLiquidityProductBreakdownItem = {
  accountProduct: string;
  accountCount: number;
  totalEFloat: number;
  averageBalance: number;
  lowBalanceAccounts: number;
};

export type WalletLiquidityResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
    asOfDate: string;
  };
  kpis: {
    latestTotalEFloat: number;
    latestEFloatDate: string | null;
    accountCount: number;
    lowBalanceAccounts: number;
    zeroOrNegativeAccounts: number;
    averageBalance: number;
    medianBalance: number;
    top10BalanceConcentration: number;
  };
  dailyTrend: WalletLiquidityTrendPoint[];
  productBreakdown: WalletLiquidityProductBreakdownItem[];
  metadata: {
    dataFreshnessTimestamp: string;
    sourceBalanceCurrentTable: string;
    lowBalanceThreshold: number;
  };
};

export type WalletLiquidityParams = {
  dateFrom: string;
  dateTo: string;
  asOfDate?: string;
  currency?: "USD" | "ZWL";
};

export type WalletCustomer360Summary = {
  customerId: string;
  fullName: string | null;
  mobileNumber: string | null;
  firstSeenDate: string;
  lastSeenDate: string;
  daysSinceLastActivity: number;
  dormancyStatus: "active" | "watch" | "dormant";
  lifetimeTransactionValue: number;
  lifetimeTransactionVolume: number;
  lifetimeCommission: number;
  last30DayTransactionValue: number;
  last60DayTransactionValue: number;
};

export type WalletCustomer360ListResponse = {
  items: WalletCustomer360Summary[];
  page: number;
  pageSize: number;
  total: number;
  metadata: {
    dataFreshnessTimestamp: string;
  };
};

export type WalletCustomer360TrendPoint = {
  period: string;
  transactionValue: number;
  transactionVolume: number;
  commission: number;
  depositValue: number;
  withdrawalValue: number;
};

export type WalletCustomer360DetailResponse = {
  customer: WalletCustomer360Summary;
  kpis: {
    selectedPeriodTransactionValue: number;
    selectedPeriodTransactionVolume: number;
    selectedPeriodCommission: number;
    last90DayTransactionValue: number;
    last90DayTransactionVolume: number;
    averageTransactionValue: number;
  };
  dailyTrend: WalletCustomer360TrendPoint[];
  metadata: {
    dataFreshnessTimestamp: string;
    sourceSummaryTable: string;
  };
};

export type WalletCustomer360ListParams = {
  search?: string;
  status?: "all" | "active_a30" | "dormant_90";
  page?: number;
  pageSize?: number;
  asOfDate?: string;
  currency?: "USD" | "ZWL";
};

export type WalletCustomer360DetailParams = {
  customerId: string;
  dateFrom: string;
  dateTo: string;
  asOfDate?: string;
  currency?: "USD" | "ZWL";
};

export type WalletInsightAlertSeverity = "critical" | "warning" | "positive" | "info";
export type WalletInsightAlertCategory =
  | "growth"
  | "activity"
  | "dormancy"
  | "revenue"
  | "liquidity"
  | "cash_flow";

export type WalletInsightAlertItem = {
  id: string;
  severity: WalletInsightAlertSeverity;
  category: WalletInsightAlertCategory;
  title: string;
  metricLabel: string;
  metricValue: number;
  thresholdLabel: string;
  message: string;
  suggestedAction: string;
};

export type WalletInsightsAlertsResponse = {
  period: {
    dateFrom: string;
    dateTo: string;
    asOfDate: string;
  };
  summary: {
    criticalCount: number;
    warningCount: number;
    positiveCount: number;
    infoCount: number;
    totalAlerts: number;
  };
  alerts: WalletInsightAlertItem[];
  metadata: {
    dataFreshnessTimestamp: string;
    sourceSummaryTable: string;
    sourceBalanceCurrentTable: string;
  };
};

export type WalletInsightsAlertsParams = {
  dateFrom: string;
  dateTo: string;
  asOfDate?: string;
  currency?: "USD" | "ZWL";
};
