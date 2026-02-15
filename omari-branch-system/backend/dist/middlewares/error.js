"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.notFoundHandler = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
function getErrorStatus(error) {
    const status = error.status;
    if (!status || !Number.isInteger(status) || status < 400 || status > 599) {
        return 500;
    }
    return status;
}
const notFoundHandler = (_req, res) => {
    res.status(404).json({ error: "Not found" });
};
exports.notFoundHandler = notFoundHandler;
const errorHandler = (error, _req, res, _next) => {
    if (res.headersSent) {
        return;
    }
    if (error instanceof zod_1.ZodError) {
        res.status(400).json({
            error: "Validation error",
            details: error.flatten(),
        });
        return;
    }
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002") {
        res.status(409).json({
            error: "Conflict",
            details: {
                code: error.code,
                target: error.meta?.target,
            },
        });
        return;
    }
    if (error instanceof SyntaxError &&
        typeof error.message === "string" &&
        "body" in error) {
        res.status(400).json({
            error: "Validation error",
            details: "Invalid JSON payload",
        });
        return;
    }
    const httpError = error;
    const status = getErrorStatus(httpError);
    const payload = {
        error: status >= 500
            ? "Internal server error"
            : httpError.message || "Request failed",
    };
    if (httpError.details !== undefined) {
        payload.details = httpError.details;
    }
    if (status >= 500) {
        console.error(error);
    }
    res.status(status).json(payload);
};
exports.errorHandler = errorHandler;
