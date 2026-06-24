export type SectionType =
  | "BRANCH_PERFORMANCE"
  | "TOP_PERFORMERS"
  | "WALLET_SUMMARY"
  | "WALLET_RETENTION"
  | "ALERTS_SUMMARY";

export type BranchPerformanceParams = {
  showCashIn?: boolean;
  showCashOut?: boolean;
  showEFloat?: boolean;
  showCommission?: boolean;
  sortBy?: "branchName" | "cashIn" | "cashOut" | "eFloat" | "commission";
  order?: "asc" | "desc";
};

export type TopPerformersParams = {
  metric?: "cashIn" | "cashOut" | "eFloat" | "commission";
  limit?: number;
  order?: "asc" | "desc";
};

export type WalletSummaryParams = Record<string, never>;

export type WalletRetentionParams = Record<string, never>;

export type AlertsSummaryParams = {
  limit?: number;
};

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

// ─── Section data shapes returned by the data service ───────────────────────

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

export type BranchPerformanceSectionData = {
  type: "BRANCH_PERFORMANCE";
  date: string;
  params: BranchPerformanceParams;
  rows: BranchRow[];
};

export type TopPerformerRow = {
  rank: number;
  branchName: string;
  value: number;
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

export type SectionData =
  | BranchPerformanceSectionData
  | TopPerformersSectionData
  | WalletSummarySectionData
  | WalletRetentionSectionData
  | AlertsSummarySectionData;
