export type SectionType =
  | "BRANCH_PERFORMANCE"
  | "TOP_PERFORMERS"
  | "WALLET_SUMMARY"
  | "WALLET_RETENTION"
  | "ALERTS_SUMMARY"
  | "FLOAT_POSITION"
  | "TRANSACTION_TRENDS"
  | "NEW_CUSTOMERS"
  | "TOP_WALLET_CUSTOMERS"
  | "REVENUE_BREAKDOWN"
  | "UPCOMING_PAYMENTS"
  | "OVERDUE_SUMMARY"
  | "WEEK_SNAPSHOT";

// ─── Param types ─────────────────────────────────────────────────────────────

export type BranchPerformanceParams = {
  showCashIn?: boolean;
  showCashOut?: boolean;
  showEFloat?: boolean;
  showCommission?: boolean;
  sortBy?: "branchName" | "cashIn" | "cashOut" | "eFloat" | "commission";
  order?: "asc" | "desc";
};

export type TopPerformerMetric = "cashIn" | "cashOut" | "eFloat" | "commission";

export type TopPerformersParams = {
  metrics?: TopPerformerMetric[];
  sortBy?: TopPerformerMetric;
  limit?: number;
  order?: "asc" | "desc";
};

export type WalletSummaryParams = Record<string, never>;
export type WalletRetentionParams = Record<string, never>;

export type AlertsSummaryParams = {
  limit?: number;
};

export type FloatPositionParams = {
  threshold?: number;
  order?: "asc" | "desc";
};

export type TransactionTrendMetric = "cashIn" | "cashOut" | "volume";

export type TransactionTrendsParams = {
  metrics?: TransactionTrendMetric[];
  sortBy?: TransactionTrendMetric;
};

export type NewCustomersParams = Record<string, never>;

export type WalletCustomerMetric = "last30d" | "lifetime";

export type TopWalletCustomersParams = {
  metrics?: WalletCustomerMetric[];
  sortBy?: WalletCustomerMetric;
  limit?: number;
};

export type RevenueBreakdownParams = Record<string, never>;

export type UpcomingPaymentsParams = {
  daysAhead?: number;
};

export type OverdueSummaryParams = Record<string, never>;

export type WeekSnapshotMetric = "cashIn" | "cashOut" | "volume" | "commission";

export type WeekSnapshotParams = {
  metrics?: WeekSnapshotMetric[];
};

// ─── Shared row types ─────────────────────────────────────────────────────────

export type ReportSection = {
  id: string;
  type: SectionType;
  params: Record<string, unknown>;
};

export type UserReportConfigData = {
  isEnabled: boolean;
  deliveryEmail: string;
  sections: ReportSection[];
  branchIds: string[];
};

export type BranchRow = {
  branchName: string;
  cashInValue: number;
  cashInVolume: number;
  cashOutValue: number;
  cashOutVolume: number;
  eFloatBalance: number;
  totalCommission: number;
  totalTransactionVolume: number;
};

// ─── Section data shapes ──────────────────────────────────────────────────────

export type BranchPerformanceSectionData = {
  type: "BRANCH_PERFORMANCE";
  date: string;
  params: BranchPerformanceParams;
  rows: BranchRow[];
};

export type TopPerformerRow = {
  rank: number;
  branchName: string;
  cashIn?: number;
  cashOut?: number;
  eFloat?: number;
  commission?: number;
};
export type TopPerformersSectionData = {
  type: "TOP_PERFORMERS";
  date: string;
  params: TopPerformersParams;
  rows: TopPerformerRow[];
};

export type WalletSummarySectionData = {
  type: "WALLET_SUMMARY";
  asOfDate: string;
  totalCustomers: number;
  activeIn30Days: number;
  newIn30Days: number;
  dormantOver90Days: number;
  totalLifetimeValue: number;
  activityIn30Days: number;
};

export type WalletRetentionSectionData = {
  type: "WALLET_RETENTION";
  asOfDate: string;
  active30: number;
  inactive30to60: number;
  inactive60to90: number;
  dormant90plus: number;
  totalCustomers: number;
};

export type AlertRow = {
  branchName: string;
  expenseType: string;
  dueDate: string;
  dayOffset: number;
  sentAt: string;
};
export type AlertsSummarySectionData = {
  type: "ALERTS_SUMMARY";
  params: AlertsSummaryParams;
  alerts: AlertRow[];
};

export type FloatPositionRow = {
  branchName: string;
  eFloatBalance: number;
  status: "low" | "ok" | "good";
};
export type FloatPositionSectionData = {
  type: "FLOAT_POSITION";
  date: string;
  params: FloatPositionParams;
  threshold: number;
  rows: FloatPositionRow[];
};

export type TransactionTrendMetricData = {
  yesterday: number;
  avg7d: number;
  changePercent: number;
};
export type TransactionTrendRow = {
  branchName: string;
  cashIn?: TransactionTrendMetricData;
  cashOut?: TransactionTrendMetricData;
  volume?: TransactionTrendMetricData;
};
export type TransactionTrendsSectionData = {
  type: "TRANSACTION_TRENDS";
  date: string;
  params: TransactionTrendsParams;
  rows: TransactionTrendRow[];
};

export type NewCustomersSectionData = {
  type: "NEW_CUSTOMERS";
  date: string;
  newYesterday: number;
  avg7d: number;
  totalThisMonth: number;
};

export type WalletCustomerRow = {
  rank: number;
  fullName: string;
  mobileNumber: string;
  last30d?: number;
  lifetime?: number;
  lifetimeVolume: number;
};
export type TopWalletCustomersSectionData = {
  type: "TOP_WALLET_CUSTOMERS";
  asOfDate: string;
  params: TopWalletCustomersParams;
  rows: WalletCustomerRow[];
};

export type RevenueBreakdownRow = {
  branchName: string;
  commissionOnDeposits: number;
  commissionOnWithdrawals: number;
  totalCommission: number;
};
export type RevenueBreakdownSectionData = {
  type: "REVENUE_BREAKDOWN";
  date: string;
  totalDeposits: number;
  totalWithdrawals: number;
  grandTotal: number;
  rows: RevenueBreakdownRow[];
};

export type UpcomingPaymentRow = {
  branchName: string;
  expenseType: string;
  dueDate: string;
  amount: number;
  currency: string;
  daysUntilDue: number;
};
export type UpcomingPaymentsSectionData = {
  type: "UPCOMING_PAYMENTS";
  asOfDate: string;
  params: UpcomingPaymentsParams;
  payments: UpcomingPaymentRow[];
};

export type OverduePaymentRow = {
  branchName: string;
  expenseType: string;
  dueDate: string;
  amount: number;
  currency: string;
  daysOverdue: number;
};
export type OverdueSummarySectionData = {
  type: "OVERDUE_SUMMARY";
  asOfDate: string;
  payments: OverduePaymentRow[];
  totalAmount: number;
};

export type WeekSnapshotDay = {
  date: string;
  dayLabel: string;
  cashIn?: number;
  cashOut?: number;
  commission?: number;
  volume?: number;
};
export type WeekSnapshotSectionData = {
  type: "WEEK_SNAPSHOT";
  params: WeekSnapshotParams;
  days: WeekSnapshotDay[];
  grandVolume: number;
  grandCashIn?: number;
  grandCashOut?: number;
  grandCommission?: number;
};

export type SectionData =
  | BranchPerformanceSectionData
  | TopPerformersSectionData
  | WalletSummarySectionData
  | WalletRetentionSectionData
  | AlertsSummarySectionData
  | FloatPositionSectionData
  | TransactionTrendsSectionData
  | NewCustomersSectionData
  | TopWalletCustomersSectionData
  | RevenueBreakdownSectionData
  | UpcomingPaymentsSectionData
  | OverdueSummarySectionData
  | WeekSnapshotSectionData;
