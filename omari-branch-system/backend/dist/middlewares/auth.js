"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireWriteAccess = exports.requireAuthenticatedUser = void 0;
const env_1 = require("../config/env");
const prisma_1 = require("../db/prisma");
const token_1 = require("../utils/token");
const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
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
function readBearerToken(req) {
    const authorization = normalizeHeaderValue(req.headers.authorization)?.trim();
    if (!authorization) {
        return null;
    }
    const [scheme, token] = authorization.split(" ");
    if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
        return null;
    }
    const normalizedToken = token.trim();
    return normalizedToken || null;
}
const requireAuthenticatedUser = async (req, _res, next) => {
    try {
        const token = readBearerToken(req);
        if (!token) {
            next(toHttpError("Unauthorized", 401));
            return;
        }
        const payload = (0, token_1.verifyAuthToken)(token, env_1.env.AUTH_TOKEN_SECRET);
        if (!payload || !/^\d+$/.test(payload.sub)) {
            next(toHttpError("Unauthorized", 401));
            return;
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: BigInt(payload.sub) },
            select: {
                id: true,
                username: true,
                role: true,
                isActive: true,
            },
        });
        if (!user || !user.isActive) {
            next(toHttpError("Unauthorized", 401));
            return;
        }
        req.authUser = {
            id: user.id,
            username: user.username,
            role: user.role,
        };
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requireAuthenticatedUser = requireAuthenticatedUser;
const requireWriteAccess = (req, _res, next) => {
    if (READ_ONLY_METHODS.has(req.method.toUpperCase())) {
        next();
        return;
    }
    if (!req.authUser) {
        next(toHttpError("Unauthorized", 401));
        return;
    }
    if (req.authUser.role !== "FULL_ACCESS") {
        next(toHttpError("Forbidden", 403));
        return;
    }
    next();
};
exports.requireWriteAccess = requireWriteAccess;
