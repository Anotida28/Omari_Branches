"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const documents_controller_1 = require("../controllers/documents.controller");
const router = (0, express_1.Router)();
router.post("/", documents_controller_1.createDocumentHandler);
router.delete("/:id", documents_controller_1.deleteDocumentHandler);
exports.default = router;
