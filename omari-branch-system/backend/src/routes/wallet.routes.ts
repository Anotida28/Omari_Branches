import { Router } from "express";

import { getWalletOverviewHandler } from "../controllers/wallet.controller";

const router = Router();

router.get("/overview", getWalletOverviewHandler);

export default router;
