import { Router } from "express";

import {
  deleteMetricHandler,
  getMetricByBranchDateHandler,
  getMetricByIdHandler,
  getSourceMetricMappingHandler,
  listMetricsHandler,
  syncMetricsFromSourceHandler,
  upsertMetricHandler,
} from "../controllers/metrics.controller";

const router = Router();

router.get("/source-mapping", getSourceMetricMappingHandler);
router.post("/sync", syncMetricsFromSourceHandler);
router.post("/upsert", upsertMetricHandler);
router.get("/", listMetricsHandler);
router.get("/by-branch-date", getMetricByBranchDateHandler);
router.get("/:id", getMetricByIdHandler);
router.delete("/:id", deleteMetricHandler);

export default router;
