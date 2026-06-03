import { Router } from "express";

import {
  sendTestEmailHandler,
  getWalletSnapshotStatusHandler,
  triggerWalletSnapshotHandler,
} from "../controllers/admin.controller";

const router = Router();

router.post("/test-email", sendTestEmailHandler);
router.get("/wallet-snapshot/status", getWalletSnapshotStatusHandler);
router.post("/wallet-snapshot/sync", triggerWalletSnapshotHandler);

export default router;
