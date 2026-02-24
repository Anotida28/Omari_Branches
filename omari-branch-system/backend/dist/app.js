"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const auth_1 = require("./middlewares/auth");
const error_1 = require("./middlewares/error");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
const frontendDistPath = node_path_1.default.resolve(__dirname, "../../frontend/dist");
const frontendIndexPath = node_path_1.default.join(frontendDistPath, "index.html");
const hasFrontendBuild = node_fs_1.default.existsSync(frontendIndexPath);
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "2mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "omari-branch-system-backend" });
});
app.use("/api/auth", auth_routes_1.default);
app.use("/api", auth_1.requireAuthenticatedUser, auth_1.requireWriteAccess, routes_1.default);
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
