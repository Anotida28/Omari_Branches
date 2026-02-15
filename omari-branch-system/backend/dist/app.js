"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const auth_1 = require("./middlewares/auth");
const error_1 = require("./middlewares/error");
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "2mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "omari-branch-system-backend" });
});
// All API routes
app.use("/api", auth_1.validateApiKeyHeader, auth_1.requireApiKey, routes_1.default);
app.use(error_1.notFoundHandler);
app.use(error_1.errorHandler);
exports.default = app;
