import { Prisma, type AlertLog } from "@prisma/client";

import {
  AlertRuleType,
  AlertSendStatus,
  type AlertRuleType as AlertRuleTypeValue,
  type AlertSendStatus as AlertSendStatusValue,
} from "../shared/prisma-enums";

import { prisma } from "../db/prisma";
import { getPagination } from "../utils/pagination";

export class AlertLogServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AlertLogServiceError";
  }
}

// ============================================================================
// Types
// ============================================================================

export type AlertLogListParams = {
  branchId?: bigint;
  expenseId?: bigint;
  ruleType?: AlertRuleTypeValue;
  status?: AlertSendStatusValue;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
};

export type AlertLogExpenseSummary = {
  id: string;
  expenseType: string;
  period: string;
  dueDate: string;
  amount: string;
};

export type AlertLogBranchSummary = {
  id: string;
  displayName: string;
  city: string;
  label: string;
};

export type AlertLogRuleSummary = {
  ruleType: AlertRuleTypeValue;
  dayOffset: number;
  description: string;
};

export type AlertLogResponse = {
  id: string;
  expenseId: string;
  branch: AlertLogBranchSummary;
  expense: AlertLogExpenseSummary;
  rule: AlertLogRuleSummary;
  sentTo: string;
  sentAt: string;
  status: AlertSendStatusValue;
  errorMessage: string | null;
};

export type AlertLogListResult = {
  items: AlertLogResponse[];
  page: number;
  pageSize: number;
  total: number;
};

// ============================================================================
// Helpers
// ============================================================================

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(date: Date): string {
  return date.toISOString();
}

function decimalToString(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toString();
}

function getRuleDescription(ruleType: AlertRuleTypeValue, dayOffset: number): string {
  if (ruleType === "DUE_REMINDER") {
    const days = Math.abs(dayOffset);
    return `${days} day${days !== 1 ? "s" : ""} before due`;
  }
  if (ruleType === "OVERDUE_ESCALATION") {
    return `${dayOffset} day${dayOffset !== 1 ? "s" : ""} overdue`;
  }
  return `${ruleType} (offset: ${dayOffset})`;
}

type AlertLogWithRelations = AlertLog & {
  expense: {
    id: bigint;
    branchId: bigint;
    expenseType: string;
    period: string;
    dueDate: Date;
    amount: Prisma.Decimal;
    branch: {
      id: bigint;
      city: string;
      label: string;
    };
  };
};

function toAlertLogResponse(log: AlertLogWithRelations): AlertLogResponse {
  return {
    id: log.id.toString(),
    expenseId: log.expenseId.toString(),
    branch: {
      id: log.expense.branchId.toString(),
      displayName: `${log.expense.branch.city} - ${log.expense.branch.label}`,
      city: log.expense.branch.city,
      label: log.expense.branch.label,
    },
    expense: {
      id: log.expense.id.toString(),
      expenseType: log.expense.expenseType,
      period: log.expense.period,
      dueDate: formatDate(log.expense.dueDate),
      amount: decimalToString(log.expense.amount),
    },
    rule: {
      ruleType: log.ruleType,
      dayOffset: log.dayOffset,
      description: getRuleDescription(log.ruleType, log.dayOffset),
    },
    sentTo: log.sentTo,
    sentAt: formatDateTime(log.sentAt),
    status: log.status,
    errorMessage: log.errorMessage,
  };
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * List alert logs with filters and pagination.
 */
export async function listAlertLogs(
  params: AlertLogListParams
): Promise<AlertLogListResult> {
  const { page, pageSize, skip, take } = getPagination(
    params.page,
    params.pageSize
  );

  const where: Prisma.AlertLogWhereInput = {};

  if (params.expenseId !== undefined) {
    where.expenseId = params.expenseId;
  }

  if (params.branchId !== undefined) {
    where.expense = {
      branchId: params.branchId,
    };
  }

  if (params.ruleType !== undefined) {
    where.ruleType = params.ruleType;
  }

  if (params.status !== undefined) {
    where.status = params.status;
  }

  if (params.dateFrom || params.dateTo) {
    where.sentAt = {
      ...(params.dateFrom ? { gte: params.dateFrom } : {}),
      ...(params.dateTo ? { lte: params.dateTo } : {}),
    };
  }

  const [total, items] = await Promise.all([
    prisma.alertLog.count({ where }),
    prisma.alertLog.findMany({
      where,
      skip,
      take,
      orderBy: { sentAt: "desc" },
      include: {
        expense: {
          include: {
            branch: {
              select: {
                id: true,
                city: true,
                label: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    items: items.map(toAlertLogResponse),
    page,
    pageSize,
    total,
  };
}

/**
 * Get a single alert log by ID.
 */
export async function getAlertLogById(
  id: bigint
): Promise<AlertLogResponse | null> {
  const log = await prisma.alertLog.findUnique({
    where: { id },
    include: {
      expense: {
        include: {
          branch: {
            select: {
              id: true,
              city: true,
              label: true,
            },
          },
        },
      },
    },
  });

  return log ? toAlertLogResponse(log) : null;
}

/**
 * Get alert log statistics summary.
 */
export async function getAlertLogStats(): Promise<{
  totalSent: number;
  totalFailed: number;
  sentToday: number;
  sentThisWeek: number;
}> {
  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalSent, totalFailed, sentToday, sentThisWeek] = await Promise.all([
    prisma.alertLog.count({ where: { status: "SENT" } }),
    prisma.alertLog.count({ where: { status: "FAILED" } }),
    prisma.alertLog.count({
      where: {
        status: "SENT",
        sentAt: { gte: todayStart },
      },
    }),
    prisma.alertLog.count({
      where: {
        status: "SENT",
        sentAt: { gte: weekStart },
      },
    }),
  ]);

  return { totalSent, totalFailed, sentToday, sentThisWeek };
}
