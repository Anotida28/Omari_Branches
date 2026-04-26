import { Router } from "express";

import {
  createBranchHandler,
  deleteBranchHandler,
  getBranchByIdHandler,
  listBranchesHandler,
  updateBranchHandler,
  validateBranchAgentLineHandler,
} from "../controllers/branches.controller";

const router = Router();

router.post("/", createBranchHandler);
router.get("/", listBranchesHandler);
router.get("/validate-agent-line", validateBranchAgentLineHandler);
router.get("/:id", getBranchByIdHandler);
router.patch("/:id", updateBranchHandler);
router.delete("/:id", deleteBranchHandler);

export default router;
