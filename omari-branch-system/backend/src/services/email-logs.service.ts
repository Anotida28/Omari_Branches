import { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma";
import { getPagination } from "../utils/pagination";

export type EmailLogListParams = {
  emailType?: string;
  status?: string;
  branchId?: bigint;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
};

export type EmailLogResponse = {
  id: string;
  emailType: string;
  sentTo: string;
  subject: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
  branchId: string | null;
  branchName: string | null;
  expenseId: string | null;
  recurringReminderId: string | null;
  reportDate: string | null;
  metadata: string | null;
};

export type EmailLogListResult = {
  items: EmailLogResponse[];
  page: number;
  pageSize: number;
  total: number;
};

function toDateString(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export async function listEmailLogs(params: EmailLogListParams): Promise<EmailLogListResult> {
  const { page, pageSize, skip, take } = getPagination(params.page, params.pageSize);
  const where: Prisma.EmailLogWhereInput = {};

  if (params.emailType) {
    where.emailType = params.emailType;
  }
  if (params.status) {
    where.status = params.status;
  }
  if (params.branchId !== undefined) {
    where.branchId = params.branchId;
  }
  if (params.dateFrom || params.dateTo) {
    where.sentAt = {
      ...(params.dateFrom ? { gte: params.dateFrom } : {}),
      ...(params.dateTo ? { lte: params.dateTo } : {}),
    };
  }

  const [total, items] = await Promise.all([
    prisma.emailLog.count({ where }),
    prisma.emailLog.findMany({
      where,
      skip,
      take,
      orderBy: { sentAt: "desc" },
      include: {
        branch: { select: { city: true, label: true } },
      },
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    items: items.map((log) => ({
      id: log.id.toString(),
      emailType: log.emailType,
      sentTo: log.sentTo,
      subject: log.subject,
      status: log.status,
      errorMessage: log.errorMessage,
      sentAt: log.sentAt.toISOString(),
      branchId: log.branchId?.toString() ?? null,
      branchName: log.branch ? `${log.branch.city} - ${log.branch.label}` : null,
      expenseId: log.expenseId?.toString() ?? null,
      recurringReminderId: log.recurringReminderId?.toString() ?? null,
      reportDate: toDateString(log.reportDate),
      metadata: log.metadata,
    })),
  };
}
