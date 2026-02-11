import {
  ExpenseStatus,
  type Expense,
  type Payment,
  type Document,
  Prisma,
  type ExpenseType,
  type DocumentType,
} from "@prisma/client";

import { prisma } from "../db/prisma";
import { getPagination } from "../utils/pagination";

export class ExpenseServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ExpenseServiceError";
  }
}

export type ExpenseCreateInput = {
  branchId: bigint;
  expenseType: ExpenseType;
  period: string;
  dueDate: Date;
  amount: number;
  currency?: string;
  vendor?: string;
  notes?: string;
  createdBy?: string;
};

export type ExpenseUpdateInput = {
  expenseType?: ExpenseType;
  period?: string;
  dueDate?: Date;
  amount?: number;
  currency?: string;
  vendor?: string;
  notes?: string;
};

export type ExpenseListParams = {
  branchId?: bigint;
  status?: ExpenseStatus;
  expenseType?: ExpenseType;
  period?: string;
  dueFrom?: Date;
  dueTo?: Date;
  page?: number;
  pageSize?: number;
};

export type ExpenseResponse = {
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

export type PaymentResponse = {
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

export type DocumentResponse = {
  id: string;
  docType: DocumentType;
  fileName: string;
  mimeType: string | null;
  sizeBytes: string | null;
  storageKey: string;
  expenseId: string | null;
  paymentId: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
};

export type ExpenseDetailResponse = ExpenseResponse & {
  payments: PaymentResponse[];
  documents: DocumentResponse[];
};

export type ExpenseListResult = {
  items: ExpenseResponse[];
  page: number;
  pageSize: number;
  total: number;
};

const ZERO = new Prisma.Decimal(0);

function decimalToString(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toString();
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(date: Date): string {
  return date.toISOString();
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function computeExpenseStatus(
  amount: Prisma.Decimal,
  totalPaid: Prisma.Decimal,
  dueDate: Date,
): ExpenseStatus {
  if (totalPaid.greaterThanOrEqualTo(amount)) {
    return ExpenseStatus.PAID;
  }

  const today = startOfTodayUtc();
  if (dueDate.getTime() < today.getTime()) {
    return ExpenseStatus.OVERDUE;
  }

  return ExpenseStatus.PENDING;
}

function sumPayments(payments: Payment[]): Prisma.Decimal {
  return payments.reduce(
    (sum, payment) => sum.plus(payment.amountPaid),
    ZERO,
  );
}

function toPaymentResponse(payment: Payment): PaymentResponse {
  return {
    id: payment.id.toString(),
    expenseId: payment.expenseId.toString(),
    paidDate: formatDate(payment.paidDate),
    amountPaid: decimalToString(payment.amountPaid),
    currency: payment.currency,
    reference: payment.reference,
    notes: payment.notes,
    createdBy: payment.createdBy,
    createdAt: formatDateTime(payment.createdAt),
  };
}

function toDocumentResponse(document: Document): DocumentResponse {
  return {
    id: document.id.toString(),
    docType: document.docType,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes:
      document.fileSize === null || document.fileSize === undefined
        ? null
        : document.fileSize.toString(),
    storageKey: document.filePath,
    expenseId: document.expenseId ? document.expenseId.toString() : null,
    paymentId: document.paymentId ? document.paymentId.toString() : null,
    uploadedBy: document.uploadedBy,
    uploadedAt: formatDateTime(document.uploadedAt),
  };
}

export function buildExpenseResponse(
  expense: Expense,
  totalPaid: Prisma.Decimal,
): ExpenseResponse {
  const amount = new Prisma.Decimal(expense.amount);
  const status = computeExpenseStatus(amount, totalPaid, expense.dueDate);
  const balance = amount.minus(totalPaid);
  const balanceRemaining = balance.lessThan(0) ? ZERO : balance;

  return {
    id: expense.id.toString(),
    branchId: expense.branchId.toString(),
    expenseType: expense.expenseType,
    period: expense.period,
    dueDate: formatDate(expense.dueDate),
    amount: decimalToString(expense.amount),
    currency: expense.currency,
    status,
    vendor: expense.vendor,
    notes: expense.notes,
    createdBy: expense.createdBy,
    createdAt: formatDateTime(expense.createdAt),
    updatedAt: formatDateTime(expense.updatedAt),
    totalPaid: totalPaid.toString(),
    balanceRemaining: balanceRemaining.toString(),
    isOverdue: status === ExpenseStatus.OVERDUE,
  };
}

export async function getTotalPaidForExpense(
  expenseId: bigint,
): Promise<Prisma.Decimal> {
  const aggregate = await prisma.payment.aggregate({
    where: { expenseId },
    _sum: { amountPaid: true },
  });

  return aggregate._sum.amountPaid
    ? new Prisma.Decimal(aggregate._sum.amountPaid)
    : ZERO;
}

export async function refreshExpenseStatus(expenseId: bigint): Promise<{
  expense: Expense;
  totalPaid: Prisma.Decimal;
  status: ExpenseStatus;
}> {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
  });

  if (!expense) {
    throw new ExpenseServiceError("Expense not found", 404);
  }

  const totalPaid = await getTotalPaidForExpense(expenseId);
  const status = computeExpenseStatus(
    new Prisma.Decimal(expense.amount),
    totalPaid,
    expense.dueDate,
  );

  if (expense.status !== status) {
    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: { status },
    });
    return { expense: updated, totalPaid, status };
  }

  return { expense, totalPaid, status };
}

function mapForeignKeyError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      throw new ExpenseServiceError("Branch not found", 404);
    }
  }
  throw error;
}

function mapNotFoundError(error: unknown): null | never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return null;
    }
  }
  throw error;
}

export async function createExpense(
  input: ExpenseCreateInput,
): Promise<ExpenseResponse> {
  const status = computeExpenseStatus(
    new Prisma.Decimal(input.amount),
    ZERO,
    input.dueDate,
  );

  const data: Prisma.ExpenseCreateInput = {
    branch: { connect: { id: input.branchId } },
    expenseType: input.expenseType,
    period: input.period,
    dueDate: input.dueDate,
    amount: input.amount,
    currency: input.currency,
    vendor: input.vendor,
    notes: input.notes,
    createdBy: input.createdBy,
    status,
  };

  try {
    const expense = await prisma.expense.create({ data });
    return buildExpenseResponse(expense, ZERO);
  } catch (error) {
    mapForeignKeyError(error);
  }
}

export async function updateExpense(
  id: bigint,
  input: ExpenseUpdateInput,
): Promise<ExpenseResponse | null> {
  const data: Prisma.ExpenseUpdateInput = {};

  if (input.expenseType !== undefined) {
    data.expenseType = input.expenseType;
  }
  if (input.period !== undefined) {
    data.period = input.period;
  }
  if (input.dueDate !== undefined) {
    data.dueDate = input.dueDate;
  }
  if (input.amount !== undefined) {
    data.amount = input.amount;
  }
  if (input.currency !== undefined) {
    data.currency = input.currency;
  }
  if (input.vendor !== undefined) {
    data.vendor = input.vendor;
  }
  if (input.notes !== undefined) {
    data.notes = input.notes;
  }

  try {
    const expense = await prisma.expense.update({
      where: { id },
      data,
    });

    const totalPaid = await getTotalPaidForExpense(id);
    const status = computeExpenseStatus(
      new Prisma.Decimal(expense.amount),
      totalPaid,
      expense.dueDate,
    );

    if (expense.status !== status) {
      const updated = await prisma.expense.update({
        where: { id },
        data: { status },
      });
      return buildExpenseResponse(updated, totalPaid);
    }

    return buildExpenseResponse(expense, totalPaid);
  } catch (error) {
    return mapNotFoundError(error);
  }
}

export async function listExpenses(
  params: ExpenseListParams,
): Promise<ExpenseListResult> {
  const { page, pageSize, skip, take } = getPagination(
    params.page,
    params.pageSize,
  );

  const where: Prisma.ExpenseWhereInput = {};

  if (params.branchId !== undefined) {
    where.branchId = params.branchId;
  }

  if (params.expenseType) {
    where.expenseType = params.expenseType;
  }

  if (params.period) {
    where.period = params.period;
  }

  const dueDateFilter: Prisma.DateTimeFilter = {};
  if (params.dueFrom) {
    dueDateFilter.gte = params.dueFrom;
  }
  if (params.dueTo) {
    dueDateFilter.lte = params.dueTo;
  }

  if (params.status) {
    const today = startOfTodayUtc();
    if (params.status === ExpenseStatus.PAID) {
      where.status = ExpenseStatus.PAID;
    } else {
      where.status = { not: ExpenseStatus.PAID };
      if (params.status === ExpenseStatus.OVERDUE) {
        dueDateFilter.lt = today;
      } else if (params.status === ExpenseStatus.PENDING) {
        const currentGte = dueDateFilter.gte;
        if (!currentGte || currentGte.getTime() < today.getTime()) {
          dueDateFilter.gte = today;
        }
      }
    }
  }

  if (Object.keys(dueDateFilter).length > 0) {
    where.dueDate = dueDateFilter;
  }

  const [total, expenses] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      skip,
      take,
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  if (expenses.length === 0) {
    return {
      items: [],
      page,
      pageSize,
      total,
    };
  }

  const expenseIds = expenses.map((expense) => expense.id);
  const totals = await prisma.payment.groupBy({
    by: ["expenseId"],
    where: { expenseId: { in: expenseIds } },
    _sum: { amountPaid: true },
  });

  const totalsMap = new Map<string, Prisma.Decimal>();
  for (const entry of totals) {
    const amountPaid = entry._sum.amountPaid ?? ZERO;
    totalsMap.set(
      entry.expenseId.toString(),
      new Prisma.Decimal(amountPaid),
    );
  }

  return {
    items: expenses.map((expense) =>
      buildExpenseResponse(
        expense,
        totalsMap.get(expense.id.toString()) ?? ZERO,
      ),
    ),
    page,
    pageSize,
    total,
  };
}

export async function getExpenseById(
  id: bigint,
): Promise<ExpenseDetailResponse | null> {
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      payments: { orderBy: { paidDate: "desc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });

  if (!expense) {
    return null;
  }

  const totalPaid = sumPayments(expense.payments);
  const base = buildExpenseResponse(expense, totalPaid);

  return {
    ...base,
    payments: expense.payments.map(toPaymentResponse),
    documents: expense.documents.map(toDocumentResponse),
  };
}

export async function deleteExpense(id: bigint): Promise<boolean> {
  try {
    await prisma.expense.delete({ where: { id } });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return false;
    }
    throw error;
  }
}
