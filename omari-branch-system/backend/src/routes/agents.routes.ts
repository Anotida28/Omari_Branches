import { Router } from "express";

import { handleGetAgentTrends, handleListAllAgents, handleSearchAgents } from "../controllers/agents.controller";

const router = Router();

router.get("/list", handleListAllAgents);
router.get("/search", handleSearchAgents);
router.get("/trends", handleGetAgentTrends);

export default router;
