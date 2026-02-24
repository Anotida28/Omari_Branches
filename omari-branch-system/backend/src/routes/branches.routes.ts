import { Router } from "express";

import {
  createBranchHandler,
  deleteBranchHandler,
  getBranchByIdHandler,
  listBranchesHandler,
  updateBranchHandler,
} from "../controllers/branches.controller";
import {
  createRecipientHandler,
  listRecipientsHandler,
} from "../controllers/recipients.controller";

const router = Router();

router.post("/", createBranchHandler);
router.get("/", listBranchesHandler);
router.get("/:id", getBranchByIdHandler);
router.patch("/:id", updateBranchHandler);
router.delete("/:id", deleteBranchHandler);

// Recipients nested under branches
router.get("/:branchId/recipients", listRecipientsHandler);
router.post("/:branchId/recipients", createRecipientHandler);

export default router;
