import { Router } from "express";

import { getEmailLogs } from "../controllers/email-logs.controller";

const router = Router();

router.get("/logs", getEmailLogs);

export default router;
