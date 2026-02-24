"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentServiceError = void 0;
exports.createPayment = createPayment;
exports.listPaymentsForExpense = listPaymentsForExpense;
exports.deletePayment = deletePayment;
const client_1 = require("@prisma/client");
const prisma_1 = require("../db/prisma");
const expenses_service_1 = require("./expenses.service");
class PaymentServiceError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "PaymentServiceError";
    }
}
exports.PaymentServiceError = PaymentServiceError;
function decimalToString(value) {
    return new client_1.Prisma.Decimal(value).toString();
}
function formatDate(date) {
    return date.toISOString().slice(0, 10);
}
function formatDateTime(date) {
    return date.toISOString();
}
function toPaymentResponse(payment) {
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
function mapForeignKeyError(error) {
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
            throw new PaymentServiceError("Expense not found", 404);
        }
    }
    throw error;
}
function startOfTodayUtc() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function computeExpenseStatusAfterPayment(amount, totalPaid, dueDate) {
    if (totalPaid.greaterThanOrEqualTo(amount)) {
        return client_1.ExpenseStatus.PAID;
    }
    const today = startOfTodayUtc();
    if (dueDate.getTime() < today.getTime()) {
        return client_1.ExpenseStatus.OVERDUE;
    }
    return client_1.ExpenseStatus.PENDING;
}
async function createPayment(expenseId, input) {
    if (input.amountPaid <= 0) {
        throw new PaymentServiceError("amountPaid must be greater than 0", 400);
    }
    const requested = new client_1.Prisma.Decimal(input.amountPaid);
    try {
        return await prisma_1.prisma.$transaction(async (tx) => {
            // Serialize all payments for the same expense row.
            await tx.$queryRaw `
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
                ? new client_1.Prisma.Decimal(aggregate._sum.amountPaid)
                : new client_1.Prisma.Decimal(0);
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
            const nextStatus = computeExpenseStatusAfterPayment(new client_1.Prisma.Decimal(expense.amount), totalPaidAfter, expense.dueDate);
            const expenseForResponse = expense.status === nextStatus
                ? expense
                : await tx.expense.update({
                    where: { id: expenseId },
                    data: { status: nextStatus },
                });
            return {
                payment: toPaymentResponse(payment),
                expense: (0, expenses_service_1.buildExpenseResponse)(expenseForResponse, totalPaidAfter),
            };
        });
    }
    catch (error) {
        if (error instanceof expenses_service_1.ExpenseServiceError) {
            throw new PaymentServiceError(error.message, error.status);
        }
        if (error instanceof PaymentServiceError) {
            throw error;
        }
        mapForeignKeyError(error);
    }
}
async function listPaymentsForExpense(expenseId) {
    const expense = await prisma_1.prisma.expense.findUnique({
        where: { id: expenseId },
        select: { id: true },
    });
    if (!expense) {
        return null;
    }
    const payments = await prisma_1.prisma.payment.findMany({
        where: { expenseId },
        orderBy: { paidDate: "desc" },
    });
    return payments.map(toPaymentResponse);
}
async function deletePayment(id) {
    try {
        const payment = await prisma_1.prisma.payment.delete({ where: { id } });
        try {
            await (0, expenses_service_1.refreshExpenseStatus)(payment.expenseId);
        }
        catch (error) {
            if (error instanceof expenses_service_1.ExpenseServiceError) {
                return true;
            }
            throw error;
        }
        return true;
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2025") {
            return false;
        }
        throw error;
    }
}
