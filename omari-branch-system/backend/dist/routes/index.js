"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const branches_routes_1 = __importDefault(require("./branches.routes"));
const documents_routes_1 = __importDefault(require("./documents.routes"));
const expenses_routes_1 = __importDefault(require("./expenses.routes"));
const metrics_routes_1 = __importDefault(require("./metrics.routes"));
const payments_routes_1 = __importDefault(require("./payments.routes"));
const router = (0, express_1.Router)();
router.use("/branches", branches_routes_1.default);
router.use("/documents", documents_routes_1.default);
router.use("/expenses", expenses_routes_1.default);
router.use("/metrics", metrics_routes_1.default);
router.use("/payments", payments_routes_1.default);
exports.default = router;
