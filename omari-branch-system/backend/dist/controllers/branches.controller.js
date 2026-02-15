"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBranchesHandler = listBranchesHandler;
exports.getBranchByIdHandler = getBranchByIdHandler;
exports.createBranchHandler = createBranchHandler;
exports.updateBranchHandler = updateBranchHandler;
exports.deleteBranchHandler = deleteBranchHandler;
const zod_1 = require("zod");
const branches_service_1 = require("../services/branches.service");
const idSchema = zod_1.z.string().regex(/^\d+$/, "Invalid id");
const createBranchSchema = zod_1.z
    .object({
    city: zod_1.z.string().min(2),
    label: zod_1.z.string().min(2),
    address: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
})
    .strict();
const updateBranchSchema = zod_1.z
    .object({
    city: zod_1.z.string().min(2).optional(),
    label: zod_1.z.string().min(2).optional(),
    address: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
})
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
});
const listQuerySchema = zod_1.z.object({
    search: zod_1.z.string().min(1).optional(),
    page: zod_1.z.coerce.number().int().min(1).optional().default(1),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).optional().default(10),
});
function normalizeQueryValue(value) {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
    }
    return undefined;
}
function handleServiceError(res, error) {
    if (error instanceof branches_service_1.BranchServiceError) {
        res.status(error.status).json({ error: error.message });
        return true;
    }
    return false;
}
async function listBranchesHandler(req, res, next) {
    const queryInput = {
        search: normalizeQueryValue(req.query.search),
        page: normalizeQueryValue(req.query.page),
        pageSize: normalizeQueryValue(req.query.pageSize),
    };
    const parsedQuery = listQuerySchema.safeParse(queryInput);
    if (!parsedQuery.success) {
        res.status(400).json({
            error: "Validation error",
            details: parsedQuery.error.flatten(),
        });
        return;
    }
    try {
        const result = await (0, branches_service_1.listBranches)(parsedQuery.data);
        res.json(result);
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function getBranchByIdHandler(req, res, next) {
    const parsedId = idSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid id" });
        return;
    }
    try {
        const branch = await (0, branches_service_1.getBranchById)(BigInt(parsedId.data));
        if (!branch) {
            res.status(404).json({ error: "Branch not found" });
            return;
        }
        res.json({ data: branch });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function createBranchHandler(req, res, next) {
    const parsedBody = createBranchSchema.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({
            error: "Validation error",
            details: parsedBody.error.flatten(),
        });
        return;
    }
    try {
        const branch = await (0, branches_service_1.createBranch)(parsedBody.data);
        res.status(201).json({ data: branch });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function updateBranchHandler(req, res, next) {
    const parsedId = idSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid id" });
        return;
    }
    const parsedBody = updateBranchSchema.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({
            error: "Validation error",
            details: parsedBody.error.flatten(),
        });
        return;
    }
    try {
        const branch = await (0, branches_service_1.updateBranch)(BigInt(parsedId.data), parsedBody.data);
        if (!branch) {
            res.status(404).json({ error: "Branch not found" });
            return;
        }
        res.json({ data: branch });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function deleteBranchHandler(req, res, next) {
    const parsedId = idSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid id" });
        return;
    }
    try {
        const deleted = await (0, branches_service_1.deleteBranch)(BigInt(parsedId.data));
        if (!deleted) {
            res.status(404).json({ error: "Branch not found" });
            return;
        }
        res.status(204).send();
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
