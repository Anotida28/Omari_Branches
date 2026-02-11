import { Prisma, type Payment } from "@prisma/client";

import { prisma } from "../db/prisma";
import {
  ExpenseServiceError,
  type ExpenseResponse,
  buildExpenseResponse,
  getTotalPaidForExpense,
  refreshExpenseStatus,
} from "./expenses.service";

export class PaymentServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "PaymentServiceError";
  }
}

export type PaymentCreateInput = {
  paidDate: Date;
  amountPaid: number;
  currency?: string;
  reference?: string;
  notes?: string;
  createdBy?: string;
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

export type PaymentCreateResult = {
  payment: PaymentResponse;
  expense: ExpenseResponse;
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

function mapForeignKeyError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      throw new PaymentServiceError("Expense not found", 404);
    }
  }
  throw error;
}

export async function createPayment(
  expenseId: bigint,
  input: PaymentCreateInput,
): Promise<PaymentCreateResult> {
  if (input.amountPaid <= 0) {
    throw new PaymentServiceError("amountPaid must be greater than 0", 400);
  }

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
  });

  if (!expense) {
    throw new PaymentServiceError("Expense not found", 404);
  }

  const totalPaid = await getTotalPaidForExpense(expenseId);
  const remaining = new Prisma.Decimal(expense.amount).minus(totalPaid);
  const requested = new Prisma.Decimal(input.amountPaid);

  if (requested.greaterThan(remaining)) {
    throw new PaymentServiceError("Overpayment not allowed", 400);
  }

  const data: Prisma.PaymentCreateInput = {
    expense: { connect: { id: expenseId } },
    paidDate: input.paidDate,
    amountPaid: input.amountPaid,
    currency: input.currency,
    reference: input.reference,
    notes: input.notes,
    createdBy: input.createdBy,
  };

  try {
    const payment = await prisma.payment.create({ data });
    const { expense, totalPaid } = await refreshExpenseStatus(expenseId);
    return {
      payment: toPaymentResponse(payment),
      expense: buildExpenseResponse(expense, totalPaid),
    };
  } catch (error) {
    if (error instanceof ExpenseServiceError) {
      throw new PaymentServiceError(error.message, error.status);
    }
    mapForeignKeyError(error);
  }
}

export async function listPaymentsForExpense(
  expenseId: bigint,
): Promise<PaymentResponse[] | null> {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { id: true },
  });

  if (!expense) {
    return null;
  }

  const payments = await prisma.payment.findMany({
    where: { expenseId },
    orderBy: { paidDate: "desc" },
  });

  return payments.map(toPaymentResponse);
}

export async function deletePayment(id: bigint): Promise<boolean> {
  try {
    const payment = await prisma.payment.delete({ where: { id } });
    try {
      await refreshExpenseStatus(payment.expenseId);
    } catch (error) {
      if (error instanceof ExpenseServiceError) {
        return true;
      }
      throw error;
    }
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
