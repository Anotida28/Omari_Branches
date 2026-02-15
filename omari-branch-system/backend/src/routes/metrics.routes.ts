import { Router } from "express";

import {
  deleteMetricHandler,
  getMetricByBranchDateHandler,
  getMetricByIdHandler,
  listMetricsHandler,
  upsertMetricHandler,
} from "../controllers/metrics.controller";
import { listMetricDocumentsHandler } from "../controllers/documents.controller";

const router = Router();

router.post("/upsert", upsertMetricHandler);
router.get("/", listMetricsHandler);
router.get("/by-branch-date", getMetricByBranchDateHandler);
router.get("/:id/documents", listMetricDocumentsHandler);
router.get("/:id", getMetricByIdHandler);
router.delete("/:id", deleteMetricHandler);

export default router;
