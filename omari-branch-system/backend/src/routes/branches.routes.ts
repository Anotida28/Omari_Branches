import { Router } from "express";

import {
  createBranchHandler,
  deleteBranchHandler,
  getBranchByIdHandler,
  listBranchesHandler,
  updateBranchHandler,
} from "../controllers/branches.controller";

const router = Router();

router.post("/", createBranchHandler);
router.get("/", listBranchesHandler);
router.get("/:id", getBranchByIdHandler);
router.patch("/:id", updateBranchHandler);
router.delete("/:id", deleteBranchHandler);

export default router;
