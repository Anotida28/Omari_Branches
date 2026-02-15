"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateApiKeyHeader = void 0;
exports.requireApiKey = requireApiKey;
const zod_1 = require("zod");
const validate_1 = require("./validate");
const apiKeyHeaderSchema = zod_1.z
    .object({
    "x-api-key": zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(),
})
    .passthrough();
function toHttpError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
}
function normalizeHeaderValue(value) {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
    }
    return null;
}
exports.validateApiKeyHeader = (0, validate_1.validateRequest)({
    headers: apiKeyHeaderSchema,
});
function requireApiKey(req, _res, next) {
    const expectedApiKey = process.env.API_KEY?.trim();
    if (!expectedApiKey) {
        next(toHttpError("API key is not configured", 500));
        return;
    }
    const providedApiKey = normalizeHeaderValue(req.headers["x-api-key"]);
    if (!providedApiKey || providedApiKey.trim() !== expectedApiKey) {
        next(toHttpError("Unauthorized", 401));
        return;
    }
    next();
}
