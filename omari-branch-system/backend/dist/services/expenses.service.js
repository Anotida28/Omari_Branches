"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseServiceError = void 0;
exports.buildExpenseResponse = buildExpenseResponse;
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
function decimalToString(value) {
    return new client_1.Prisma.Decimal(value).toString();
}
function formatDate(date) {
    return date.toISOString().slice(0, 10);
}
function formatDateTime(date) {
    return date.toISOString();
}
function buildExpenseResponse(expense) {
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
    };
    try {
        const expense = await prisma_1.prisma.expense.create({ data });
        return buildExpenseResponse(expense);
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
        return buildExpenseResponse(expense);
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
    return {
        items: expenses.map((expense) => buildExpenseResponse(expense)),
        page,
        pageSize,
        total,
    };
}
async function getExpenseById(id) {
    const expense = await prisma_1.prisma.expense.findUnique({
        where: { id },
    });
    if (!expense) {
        return null;
    }
    return buildExpenseResponse(expense);
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
