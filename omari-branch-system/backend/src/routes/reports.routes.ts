import { Router } from "express";

import { getReportsDataHandler } from "../controllers/reports.controller";

const router = Router();

router.get("/data", getReportsDataHandler);

export default router;
