"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const morgan_1 = __importDefault(require("morgan"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const env_1 = require("./config/env");
const prisma_1 = require("./db/prisma");
const auth_1 = require("./middlewares/auth");
const error_1 = require("./middlewares/error");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
const frontendDistPath = node_path_1.default.resolve(__dirname, "../../frontend/dist");
const frontendIndexPath = node_path_1.default.join(frontendDistPath, "index.html");
const hasFrontendBuild = node_fs_1.default.existsSync(frontendIndexPath);
app.use((0, morgan_1.default)(env_1.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use((0, cors_1.default)({
    origin: env_1.env.NODE_ENV === "production"
        ? (env_1.env.FRONTEND_URL ?? false)
        : true,
}));
app.use(express_1.default.json({ limit: "2mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please slow down." },
});
const walletLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many wallet requests, please slow down." },
});
app.get("/health", async (_req, res) => {
    const checks = {};
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        checks.appDb = "ok";
    }
    catch {
        checks.appDb = "error";
    }
    try {
        const { getSourcePool, isSourceDbConfigured } = await Promise.resolve().then(() => __importStar(require("./db/source-db")));
        if (isSourceDbConfigured()) {
            const pool = await getSourcePool();
            await pool.request().query("SELECT 1");
            checks.sourceDb = "ok";
        }
        else {
            checks.sourceDb = "error";
        }
    }
    catch {
        checks.sourceDb = "error";
    }
    const allOk = Object.values(checks).every((s) => s === "ok");
    res.status(allOk ? 200 : 503).json({
        ok: allOk,
        service: "omari-branch-system-backend",
        checks,
    });
});
app.use("/api/auth", auth_routes_1.default);
app.use("/api/wallet", walletLimiter);
app.use("/api", apiLimiter, auth_1.requireAuthenticatedUser, auth_1.requireWriteAccess, routes_1.default);
if (hasFrontendBuild) {
    app.use(express_1.default.static(frontendDistPath));
    // SPA fallback: let non-API routes resolve to the built frontend app.
    app.get("*", (req, res, next) => {
        if (req.path === "/health" || req.path === "/api" || req.path.startsWith("/api/")) {
            next();
            return;
        }
        res.sendFile(frontendIndexPath);
    });
}
app.use(error_1.notFoundHandler);
app.use(error_1.errorHandler);
exports.default = app;
