import { Router } from "express";

import { getTrendsDataHandler } from "../controllers/trends.controller";

const router = Router();

router.get("/data", getTrendsDataHandler);

export default router;
