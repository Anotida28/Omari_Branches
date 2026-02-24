import { Router } from "express";

import { sendTestEmailHandler } from "../controllers/admin.controller";

const router = Router();

router.post("/test-email", sendTestEmailHandler);

export default router;
