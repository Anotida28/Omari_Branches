"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseServiceError = void 0;
exports.buildExpenseResponse = buildExpenseResponse;
exports.getTotalPaidForExpense = getTotalPaidForExpense;
exports.refreshExpenseStatus = refreshExpenseStatus;
exports.createExpense = createExpense;
exports.updateExpense = updateExpense;
exports.listExpenses = listExpenses;
exports.getExpenseById = getExpenseById;
exports.deleteExpense = deleteExpense;
const client_1 = require("@prisma/client");
const prisma_1 = require("../db/prisma");
const pagination_1 = require("../utils/pagination");
class ExpenseServiceError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "ExpenseServiceError";
    }
}
exports.ExpenseServiceError = ExpenseServiceError;
const ZERO = new client_1.Prisma.Decimal(0);
function decimalToString(value) {
    return new client_1.Prisma.Decimal(value).toString();
}
function formatDate(date) {
    return date.toISOString().slice(0, 10);
}
function formatDateTime(date) {
    return date.toISOString();
}
function startOfTodayUtc() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function computeExpenseStatus(amount, totalPaid, dueDate) {
    if (totalPaid.greaterThanOrEqualTo(amount)) {
        return client_1.ExpenseStatus.PAID;
    }
    const today = startOfTodayUtc();
    if (dueDate.getTime() < today.getTime()) {
        return client_1.ExpenseStatus.OVERDUE;
    }
    return client_1.ExpenseStatus.PENDING;
}
function sumPayments(payments) {
    return payments.reduce((sum, payment) => sum.plus(payment.amountPaid), ZERO);
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
function toDocumentResponse(document) {
    return {
        id: document.id.toString(),
        docType: document.docType,
        fileName: document.fileName,
        mimeType: document.mimeType,
        sizeBytes: document.fileSize === null || document.fileSize === undefined
            ? null
            : document.fileSize.toString(),
        storageKey: document.filePath,
        expenseId: document.expenseId ? document.expenseId.toString() : null,
        paymentId: document.paymentId ? document.paymentId.toString() : null,
        uploadedBy: document.uploadedBy,
        uploadedAt: formatDateTime(document.uploadedAt),
    };
}
function buildExpenseResponse(expense, totalPaid) {
    const amount = new client_1.Prisma.Decimal(expense.amount);
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
        isOverdue: status === client_1.ExpenseStatus.OVERDUE,
    };
}
async function getTotalPaidForExpense(expenseId) {
    const aggregate = await prisma_1.prisma.payment.aggregate({
        where: { expenseId },
        _sum: { amountPaid: true },
    });
    return aggregate._sum.amountPaid
        ? new client_1.Prisma.Decimal(aggregate._sum.amountPaid)
        : ZERO;
}
async function refreshExpenseStatus(expenseId) {
    const expense = await prisma_1.prisma.expense.findUnique({
        where: { id: expenseId },
    });
    if (!expense) {
        throw new ExpenseServiceError("Expense not found", 404);
    }
    const totalPaid = await getTotalPaidForExpense(expenseId);
    const status = computeExpenseStatus(new client_1.Prisma.Decimal(expense.amount), totalPaid, expense.dueDate);
    if (expense.status !== status) {
        const updated = await prisma_1.prisma.expense.update({
            where: { id: expenseId },
            data: { status },
        });
        return { expense: updated, totalPaid, status };
    }
    return { expense, totalPaid, status };
}
function mapCreateExpenseError(error) {
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
            throw new ExpenseServiceError("Branch not found", 404);
        }
        if (error.code === "P2002") {
            throw new ExpenseServiceError("Expense with this branch, expenseType, and period already exists", 409);
        }
    }
    throw error;
}
function mapUpdateExpenseError(error) {
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
            return null;
        }
        if (error.code === "P2002") {
            throw new ExpenseServiceError("Expense with this branch, expenseType, and period already exists", 409);
        }
    }
    throw error;
}
async function createExpense(input) {
    const status = computeExpenseStatus(new client_1.Prisma.Decimal(input.amount), ZERO, input.dueDate);
    const data = {
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
        const expense = await prisma_1.prisma.expense.create({ data });
        return buildExpenseResponse(expense, ZERO);
    }
    catch (error) {
        mapCreateExpenseError(error);
    }
}
async function updateExpense(id, input) {
    const data = {};
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
        const expense = await prisma_1.prisma.expense.update({
            where: { id },
            data,
        });
        const totalPaid = await getTotalPaidForExpense(id);
        const status = computeExpenseStatus(new client_1.Prisma.Decimal(expense.amount), totalPaid, expense.dueDate);
        if (expense.status !== status) {
            const updated = await prisma_1.prisma.expense.update({
                where: { id },
                data: { status },
            });
            return buildExpenseResponse(updated, totalPaid);
        }
        return buildExpenseResponse(expense, totalPaid);
    }
    catch (error) {
        return mapUpdateExpenseError(error);
    }
}
async function listExpenses(params) {
    const { page, pageSize, skip, take } = (0, pagination_1.getPagination)(params.page, params.pageSize);
    const where = {};
    if (params.branchId !== undefined) {
        where.branchId = params.branchId;
    }
    if (params.expenseType) {
        where.expenseType = params.expenseType;
    }
    if (params.period) {
        where.period = params.period;
    }
    const dueDateFilter = {};
    if (params.dueFrom) {
        dueDateFilter.gte = params.dueFrom;
    }
    if (params.dueTo) {
        dueDateFilter.lte = params.dueTo;
    }
    if (params.status) {
        const today = startOfTodayUtc();
        if (params.status === client_1.ExpenseStatus.PAID) {
            where.status = client_1.ExpenseStatus.PAID;
        }
        else {
            where.status = { not: client_1.ExpenseStatus.PAID };
            if (params.status === client_1.ExpenseStatus.OVERDUE) {
                dueDateFilter.lt = today;
            }
            else if (params.status === client_1.ExpenseStatus.PENDING) {
                const currentGte = dueDateFilter.gte;
                const currentGteDate = currentGte instanceof Date
                    ? currentGte
                    : currentGte
                        ? new Date(currentGte)
                        : null;
                if (!currentGteDate || currentGteDate.getTime() < today.getTime()) {
                    dueDateFilter.gte = today;
                }
            }
        }
    }
    if (Object.keys(dueDateFilter).length > 0) {
        where.dueDate = dueDateFilter;
    }
    const [total, expenses] = await Promise.all([
        prisma_1.prisma.expense.count({ where }),
        prisma_1.prisma.expense.findMany({
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
    const totals = await prisma_1.prisma.payment.groupBy({
        by: ["expenseId"],
        where: { expenseId: { in: expenseIds } },
        _sum: { amountPaid: true },
    });
    const totalsMap = new Map();
    for (const entry of totals) {
        const amountPaid = entry._sum.amountPaid ?? ZERO;
        totalsMap.set(entry.expenseId.toString(), new client_1.Prisma.Decimal(amountPaid));
    }
    return {
        items: expenses.map((expense) => buildExpenseResponse(expense, totalsMap.get(expense.id.toString()) ?? ZERO)),
        page,
        pageSize,
        total,
    };
}
async function getExpenseById(id) {
    const expense = await prisma_1.prisma.expense.findUnique({
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
async function deleteExpense(id) {
    try {
        await prisma_1.prisma.expense.delete({ where: { id } });
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
