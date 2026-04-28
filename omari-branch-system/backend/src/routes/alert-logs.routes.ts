import { Router, Request, Response, NextFunction } from "express";

import {
  getAlertLogs,
  getAlertLogByIdController,
  getAlertStatsController,
} from "../controllers/alert-logs.controller";
import {
  triggerAlertJobManually,
  triggerDailyBranchReportJobManually,
  triggerDailyWalletReportJobManually,
  getScheduledJobs,
} from "../jobs/scheduler";

const router = Router();

// GET /api/alerts/stats - Must be before /:id to avoid conflict
router.get("/stats", getAlertStatsController);

// GET /api/alerts/logs - List all alert logs with filters
router.get("/logs", getAlertLogs);

// GET /api/alerts/logs/:id - Get single alert log
router.get("/logs/:id", getAlertLogByIdController);

// POST /api/alerts/trigger - Manually trigger the alert evaluator job
router.post("/trigger", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { executed, result, error } = await triggerAlertJobManually();

    if (!executed) {
      return res.status(409).json({
        message: "Job is already running on another instance",
        executed: false,
      });
    }

    if (error) {
      return res.status(500).json({
        message: "Job failed with error",
        error: error.message,
        executed: true,
      });
    }

    res.json({
      message: "Alert evaluation job completed",
      executed: true,
      result,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts/trigger-daily-report - Manually trigger daily branch report emails
router.post("/trigger-daily-report", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { executed, result, error } = await triggerDailyBranchReportJobManually();

    if (!executed) {
      return res.status(409).json({
        message: "Job is already running on another instance",
        executed: false,
      });
    }

    if (error) {
      return res.status(500).json({
        message: "Job failed with error",
        error: error.message,
        executed: true,
      });
    }

    res.json({
      message: "Daily branch report job completed",
      executed: true,
      result,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts/trigger-wallet-report - Manually trigger daily wallet report emails
router.post("/trigger-wallet-report", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { executed, result, error } = await triggerDailyWalletReportJobManually();

    if (!executed) {
      return res.status(409).json({
        message: "Job is already running on another instance",
        executed: false,
      });
    }

    if (error) {
      return res.status(500).json({
        message: "Job failed with error",
        error: error.message,
        executed: true,
      });
    }

    res.json({
      message: "Daily wallet report job completed",
      executed: true,
      result,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/alerts/jobs - List scheduled jobs
router.get("/jobs", (_req: Request, res: Response) => {
  const jobs = getScheduledJobs();
  res.json({ jobs });
});

export default router;
