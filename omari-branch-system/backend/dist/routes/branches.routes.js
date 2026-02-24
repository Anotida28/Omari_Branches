"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const branches_controller_1 = require("../controllers/branches.controller");
const recipients_controller_1 = require("../controllers/recipients.controller");
const router = (0, express_1.Router)();
router.post("/", branches_controller_1.createBranchHandler);
router.get("/", branches_controller_1.listBranchesHandler);
router.get("/:id", branches_controller_1.getBranchByIdHandler);
router.patch("/:id", branches_controller_1.updateBranchHandler);
router.delete("/:id", branches_controller_1.deleteBranchHandler);
// Recipients nested under branches
router.get("/:branchId/recipients", recipients_controller_1.listRecipientsHandler);
router.post("/:branchId/recipients", recipients_controller_1.createRecipientHandler);
exports.default = router;
