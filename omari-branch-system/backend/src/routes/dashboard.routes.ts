import { Router } from "express";

import { getDashboardOverviewHandler } from "../controllers/dashboard.controller";

const router = Router();

router.get("/overview", getDashboardOverviewHandler);

export default router;
