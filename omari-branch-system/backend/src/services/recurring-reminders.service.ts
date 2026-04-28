import { Prisma, type RecurringExpenseReminder } from "@prisma/client";

import { prisma } from "../db/prisma";
import { getPagination } from "../utils/pagination";
import { ExpenseType, type ExpenseType as ExpenseTypeValue } from "../shared/prisma-enums";
import { daysBetween, formatDateString, getTodayInHarare } from "./alert-evaluation.service";

export class RecurringReminderServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "RecurringReminderServiceError";
  }
}

export type RecurringReminderCreateInput = {
  branchId: bigint;
  expenseType: ExpenseTypeValue;
  dueDayOfMonth: number;
  amount: number;
  currency?: string;
  vendor?: string;
  notes?: string;
  isActive?: boolean;
  createdBy?: string;
};

export type RecurringReminderUpdateInput = Partial<RecurringReminderCreateInput>;

export type RecurringReminderListParams = {
  branchId?: bigint;
  expenseType?: ExpenseTypeValue;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
};

export type RecurringReminderResponse = {
  id: string;
  branchId: string;
  expenseType: ExpenseTypeValue;
  dueDayOfMonth: number;
  amount: string;
  currency: string;
  vendor: string | null;
  notes: string | null;
  isActive: boolean;
  nextDueDate: string;
  nextReminderDate: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecurringReminderListResult = {
  items: RecurringReminderResponse[];
  page: number;
  pageSize: number;
  total: number;
};

const DEFAULT_REMINDER_DAYS = [7, 3, 1];

function decimalToString(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toString();
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function dueDateForMonth(year: number, monthIndex: number, dueDayOfMonth: number): Date {
  const day = Math.min(dueDayOfMonth, lastDayOfMonth(year, monthIndex));
  return new Date(Date.UTC(year, monthIndex, day));
}

export function periodForDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getNextDueDate(dueDayOfMonth: number, today: Date = getTodayInHarare()): Date {
  const thisMonthDue = dueDateForMonth(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    dueDayOfMonth,
  );

  if (thisMonthDue.getTime() >= today.getTime()) {
    return thisMonthDue;
  }

  return dueDateForMonth(
    today.getUTCFullYear(),
    today.getUTCMonth() + 1,
    dueDayOfMonth,
  );
}

function getNextReminderDate(dueDate: Date, today: Date): Date | null {
  const futureReminderDates = DEFAULT_REMINDER_DAYS
    .map((days) => new Date(dueDate.getTime() - days * 24 * 60 * 60 * 1000))
    .filter((date) => date.getTime() >= today.getTime())
    .sort((left, right) => left.getTime() - right.getTime());

  return futureReminderDates[0] ?? null;
}

function toResponse(
  reminder: RecurringExpenseReminder,
  today: Date = getTodayInHarare(),
): RecurringReminderResponse {
  const nextDueDate = getNextDueDate(reminder.dueDayOfMonth, today);
  const nextReminderDate = getNextReminderDate(nextDueDate, today);

  return {
    id: reminder.id.toString(),
    branchId: reminder.branchId.toString(),
    expenseType: reminder.expenseType,
    dueDayOfMonth: reminder.dueDayOfMonth,
    amount: decimalToString(reminder.amount),
    currency: reminder.currency,
    vendor: reminder.vendor,
    notes: reminder.notes,
    isActive: reminder.isActive,
    nextDueDate: formatDateString(nextDueDate),
    nextReminderDate: nextReminderDate ? formatDateString(nextReminderDate) : null,
    createdBy: reminder.createdBy,
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
  };
}

function mapWriteError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      throw new RecurringReminderServiceError("Branch not found", 404);
    }
    if (error.code === "P2025") {
      throw new RecurringReminderServiceError("Recurring reminder not found", 404);
    }
  }
  throw error;
}

function validateDueDay(day: number): void {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new RecurringReminderServiceError("Due day must be between 1 and 31", 400);
  }
}

export async function createRecurringReminder(
  input: RecurringReminderCreateInput,
): Promise<RecurringReminderResponse> {
  validateDueDay(input.dueDayOfMonth);

  try {
    const reminder = await prisma.recurringExpenseReminder.create({
      data: {
        branchId: input.branchId,
        expenseType: input.expenseType,
        dueDayOfMonth: input.dueDayOfMonth,
        amount: input.amount,
        currency: input.currency,
        vendor: input.vendor,
        notes: input.notes,
        isActive: input.isActive ?? true,
        createdBy: input.createdBy,
      },
    });
    return toResponse(reminder);
  } catch (error) {
    mapWriteError(error);
  }
}

export async function updateRecurringReminder(
  id: bigint,
  input: RecurringReminderUpdateInput,
): Promise<RecurringReminderResponse | null> {
  if (input.dueDayOfMonth !== undefined) {
    validateDueDay(input.dueDayOfMonth);
  }

  const data: Prisma.RecurringExpenseReminderUpdateInput = {};
  if (input.branchId !== undefined) data.branch = { connect: { id: input.branchId } };
  if (input.expenseType !== undefined) data.expenseType = input.expenseType;
  if (input.dueDayOfMonth !== undefined) data.dueDayOfMonth = input.dueDayOfMonth;
  if (input.amount !== undefined) data.amount = input.amount;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.vendor !== undefined) data.vendor = input.vendor;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  try {
    const reminder = await prisma.recurringExpenseReminder.update({
      where: { id },
      data,
    });
    return toResponse(reminder);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return null;
    }
    mapWriteError(error);
  }
}

export async function listRecurringReminders(
  params: RecurringReminderListParams,
): Promise<RecurringReminderListResult> {
  const { page, pageSize, skip, take } = getPagination(params.page, params.pageSize);
  const where: Prisma.RecurringExpenseReminderWhereInput = {};

  if (params.branchId !== undefined) where.branchId = params.branchId;
  if (params.expenseType) where.expenseType = params.expenseType;
  if (params.isActive !== undefined) where.isActive = params.isActive;

  const [total, items] = await Promise.all([
    prisma.recurringExpenseReminder.count({ where }),
    prisma.recurringExpenseReminder.findMany({
      where,
      skip,
      take,
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    }),
  ]);

  const today = getTodayInHarare();
  return {
    items: items.map((item) => toResponse(item, today)),
    page,
    pageSize,
    total,
  };
}

export async function getRecurringReminderById(
  id: bigint,
): Promise<RecurringReminderResponse | null> {
  const reminder = await prisma.recurringExpenseReminder.findUnique({ where: { id } });
  return reminder ? toResponse(reminder) : null;
}

export async function deleteRecurringReminder(id: bigint): Promise<boolean> {
  try {
    await prisma.recurringExpenseReminder.delete({ where: { id } });
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

export function getReminderStateForDueDate(dueDate: Date, today: Date): {
  daysToDue: number;
  state: "UPCOMING" | "DUE_TODAY" | "OVERDUE";
} {
  const daysToDue = daysBetween(today, dueDate);
  if (daysToDue < 0) {
    return { daysToDue, state: "OVERDUE" };
  }
  if (daysToDue === 0) {
    return { daysToDue, state: "DUE_TODAY" };
  }
  return { daysToDue, state: "UPCOMING" };
}

export { ExpenseType };
