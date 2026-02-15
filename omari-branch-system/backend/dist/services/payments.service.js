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
async function createPayment(expenseId, input) {
    if (input.amountPaid <= 0) {
        throw new PaymentServiceError("amountPaid must be greater than 0", 400);
    }
    const expense = await prisma_1.prisma.expense.findUnique({
        where: { id: expenseId },
    });
    if (!expense) {
        throw new PaymentServiceError("Expense not found", 404);
    }
    const totalPaid = await (0, expenses_service_1.getTotalPaidForExpense)(expenseId);
    const remaining = new client_1.Prisma.Decimal(expense.amount).minus(totalPaid);
    const requested = new client_1.Prisma.Decimal(input.amountPaid);
    if (requested.greaterThan(remaining)) {
        throw new PaymentServiceError("Overpayment not allowed", 400);
    }
    const data = {
        expense: { connect: { id: expenseId } },
        paidDate: input.paidDate,
        amountPaid: input.amountPaid,
        currency: input.currency,
        reference: input.reference,
        notes: input.notes,
        createdBy: input.createdBy,
    };
    try {
        const payment = await prisma_1.prisma.payment.create({ data });
        const { expense, totalPaid } = await (0, expenses_service_1.refreshExpenseStatus)(expenseId);
        return {
            payment: toPaymentResponse(payment),
            expense: (0, expenses_service_1.buildExpenseResponse)(expense, totalPaid),
        };
    }
    catch (error) {
        if (error instanceof expenses_service_1.ExpenseServiceError) {
            throw new PaymentServiceError(error.message, error.status);
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
