import { Router } from "express";

import {
  getWalletOverviewHandler,
  syncWalletCustomerActivityHandler,
} from "../controllers/wallet.controller";

const router = Router();

router.get("/overview", getWalletOverviewHandler);
router.post("/customer-activity/sync", syncWalletCustomerActivityHandler);

export default router;
