"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payments_controller_1 = require("../controllers/payments.controller");
const documents_controller_1 = require("../controllers/documents.controller");
const router = (0, express_1.Router)();
router.get("/:id/documents", documents_controller_1.listPaymentDocumentsHandler);
router.delete("/:id", payments_controller_1.deletePaymentHandler);
exports.default = router;
