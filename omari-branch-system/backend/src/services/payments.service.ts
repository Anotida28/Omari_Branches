import { ExpenseStatus, Prisma, type Payment } from "@prisma/client";

import { prisma } from "../db/prisma";
import {
  ExpenseServiceError,
  type ExpenseResponse,
  buildExpenseResponse,
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

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function computeExpenseStatusAfterPayment(
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

export async function createPayment(
  expenseId: bigint,
  input: PaymentCreateInput,
): Promise<PaymentCreateResult> {
  if (input.amountPaid <= 0) {
    throw new PaymentServiceError("amountPaid must be greater than 0", 400);
  }
  const requested = new Prisma.Decimal(input.amountPaid);

  try {
    return await prisma.$transaction(async (tx) => {
      // Serialize all payments for the same expense row.
      await tx.$queryRaw`
        SELECT id
        FROM Expense
        WHERE id = ${expenseId}
        FOR UPDATE
      `;

      const expense = await tx.expense.findUnique({
        where: { id: expenseId },
      });

      if (!expense) {
        throw new PaymentServiceError("Expense not found", 404);
      }

      const aggregate = await tx.payment.aggregate({
        where: { expenseId },
        _sum: { amountPaid: true },
      });

      const totalPaidBefore = aggregate._sum.amountPaid
        ? new Prisma.Decimal(aggregate._sum.amountPaid)
        : new Prisma.Decimal(0);
      const totalPaidAfter = totalPaidBefore.plus(requested);

      if (totalPaidAfter.greaterThan(expense.amount)) {
        throw new PaymentServiceError("Overpayment not allowed", 400);
      }

      const payment = await tx.payment.create({
        data: {
          expense: { connect: { id: expenseId } },
          paidDate: input.paidDate,
          amountPaid: requested,
          currency: input.currency,
          reference: input.reference,
          notes: input.notes,
          createdBy: input.createdBy,
        },
      });

      const nextStatus = computeExpenseStatusAfterPayment(
        new Prisma.Decimal(expense.amount),
        totalPaidAfter,
        expense.dueDate,
      );

      const expenseForResponse =
        expense.status === nextStatus
          ? expense
          : await tx.expense.update({
              where: { id: expenseId },
              data: { status: nextStatus },
            });

      return {
        payment: toPaymentResponse(payment),
        expense: buildExpenseResponse(expenseForResponse, totalPaidAfter),
      };
    });
  } catch (error) {
    if (error instanceof ExpenseServiceError) {
      throw new PaymentServiceError(error.message, error.status);
    }
    if (error instanceof PaymentServiceError) {
      throw error;
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
