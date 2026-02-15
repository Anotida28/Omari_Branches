"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchServiceError = void 0;
exports.listBranches = listBranches;
exports.getBranchById = getBranchById;
exports.createBranch = createBranch;
exports.updateBranch = updateBranch;
exports.deleteBranch = deleteBranch;
const client_1 = require("@prisma/client");
const prisma_1 = require("../db/prisma");
class BranchServiceError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "BranchServiceError";
    }
}
exports.BranchServiceError = BranchServiceError;
function toBranchResponse(branch) {
    return {
        id: branch.id.toString(),
        city: branch.city,
        label: branch.label,
        address: branch.address,
        isActive: branch.isActive,
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt,
        displayName: `${branch.city} - ${branch.label}`,
    };
}
function mapUniqueConstraintError(error) {
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
            throw new BranchServiceError("Branch with the same city and label already exists", 409);
        }
    }
    throw error;
}
async function listBranches(params) {
    const { search, page, pageSize } = params;
    const q = search?.trim();
    const where = q
        ? {
            OR: [{ city: { contains: q } }, { label: { contains: q } }],
        }
        : {};
    const skip = (page - 1) * pageSize;
    const [total, items] = await Promise.all([
        prisma_1.prisma.branch.count({ where }),
        prisma_1.prisma.branch.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: [{ city: "asc" }, { label: "asc" }],
        }),
    ]);
    return {
        items: items.map(toBranchResponse),
        page,
        pageSize,
        total,
    };
}
async function getBranchById(id) {
    const branch = await prisma_1.prisma.branch.findUnique({
        where: { id },
    });
    return branch ? toBranchResponse(branch) : null;
}
async function createBranch(input) {
    const data = {
        city: input.city,
        label: input.label,
    };
    if (input.address !== undefined) {
        data.address = input.address;
    }
    if (input.isActive !== undefined) {
        data.isActive = input.isActive;
    }
    try {
        const branch = await prisma_1.prisma.branch.create({ data });
        return toBranchResponse(branch);
    }
    catch (error) {
        mapUniqueConstraintError(error);
    }
}
async function updateBranch(id, input) {
    const data = {};
    if (input.city !== undefined) {
        data.city = input.city;
    }
    if (input.label !== undefined) {
        data.label = input.label;
    }
    if (input.address !== undefined) {
        data.address = input.address;
    }
    if (input.isActive !== undefined) {
        data.isActive = input.isActive;
    }
    try {
        const branch = await prisma_1.prisma.branch.update({
            where: { id },
            data,
        });
        return toBranchResponse(branch);
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
            if (error.code === "P2025") {
                return null;
            }
            if (error.code === "P2002") {
                throw new BranchServiceError("Branch with the same city and label already exists", 409);
            }
        }
        throw error;
    }
}
async function deleteBranch(id) {
    try {
        await prisma_1.prisma.branch.delete({ where: { id } });
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
