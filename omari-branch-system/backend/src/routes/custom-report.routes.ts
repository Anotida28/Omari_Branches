import { Router } from "express";
import {
  getMyReportConfig,
  saveMyReportConfig,
  sendTestReport,
} from "../controllers/custom-report.controller";

const router = Router();

router.get("/config", getMyReportConfig);
router.put("/config", saveMyReportConfig);
router.post("/test-send", sendTestReport);

export default router;
