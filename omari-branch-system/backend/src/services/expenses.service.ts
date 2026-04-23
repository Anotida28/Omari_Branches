import {
  type Expense,
  Prisma,
} from "@prisma/client";

import { prisma } from "../db/prisma";
import { getPagination } from "../utils/pagination";
import { ExpenseType, type ExpenseType as ExpenseTypeValue } from "../shared/prisma-enums";

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
  expenseType: ExpenseTypeValue;
  period: string;
  dueDate: Date;
  amount: number;
  currency?: string;
  vendor?: string;
  notes?: string;
  createdBy?: string;
};

export type ExpenseUpdateInput = {
  expenseType?: ExpenseTypeValue;
  period?: string;
  dueDate?: Date;
  amount?: number;
  currency?: string;
  vendor?: string;
  notes?: string;
};

export type ExpenseListParams = {
  branchId?: bigint;
  expenseType?: ExpenseTypeValue;
  period?: string;
  dueFrom?: Date;
  dueTo?: Date;
  page?: number;
  pageSize?: number;
};

export type ExpenseResponse = {
  id: string;
  branchId: string;
  expenseType: ExpenseTypeValue;
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

export type ExpenseDetailResponse = ExpenseResponse;

export type ExpenseListResult = {
  items: ExpenseResponse[];
  page: number;
  pageSize: number;
  total: number;
};

function decimalToString(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toString();
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(date: Date): string {
  return date.toISOString();
}

export function buildExpenseResponse(
  expense: Expense,
): ExpenseResponse {
  return {
    id: expense.id.toString(),
    branchId: expense.branchId.toString(),
    expenseType: expense.expenseType,
    period: expense.period,
    dueDate: formatDate(expense.dueDate),
    amount: decimalToString(expense.amount),
    currency: expense.currency,
    vendor: expense.vendor,
    notes: expense.notes,
    createdBy: expense.createdBy,
    createdAt: formatDateTime(expense.createdAt),
    updatedAt: formatDateTime(expense.updatedAt),
  };
}

function mapCreateExpenseError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      throw new ExpenseServiceError("Branch not found", 404);
    }
    if (error.code === "P2002") {
      throw new ExpenseServiceError(
        "Expense with this branch, expenseType, and period already exists",
        409,
      );
    }
  }
  throw error;
}

function mapUpdateExpenseError(error: unknown): null | never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return null;
    }
    if (error.code === "P2002") {
      throw new ExpenseServiceError(
        "Expense with this branch, expenseType, and period already exists",
        409,
      );
    }
  }
  throw error;
}

export async function createExpense(
  input: ExpenseCreateInput,
): Promise<ExpenseResponse> {
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
  };

  try {
    const expense = await prisma.expense.create({ data });
    return buildExpenseResponse(expense);
  } catch (error) {
    mapCreateExpenseError(error);
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
    return buildExpenseResponse(expense);
  } catch (error) {
    return mapUpdateExpenseError(error);
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

  return {
    items: expenses.map((expense) => buildExpenseResponse(expense)),
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
  });

  if (!expense) {
    return null;
  }

  return buildExpenseResponse(expense);
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
