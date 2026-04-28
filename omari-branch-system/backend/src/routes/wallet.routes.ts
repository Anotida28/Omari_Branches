import { Router } from "express";

import {
  getWalletCustomer360DetailHandler,
  getWalletCustomerActivityGrowthHandler,
  getWalletInsightsAlertsHandler,
  getWalletLiquidityHandler,
  getWalletOverviewHandler,
  getWalletRetentionDormancyHandler,
  getWalletRevenuePerformanceHandler,
  getWalletTransactionPerformanceHandler,
  getWalletVisaAnalyticsHandler,
  listWalletCustomer360Handler,
} from "../controllers/wallet.controller";

const router = Router();

router.get("/overview", getWalletOverviewHandler);
router.get("/customer-activity", getWalletCustomerActivityGrowthHandler);
router.get("/retention-dormancy", getWalletRetentionDormancyHandler);
router.get("/transaction-performance", getWalletTransactionPerformanceHandler);
router.get("/revenue-performance", getWalletRevenuePerformanceHandler);
router.get("/liquidity", getWalletLiquidityHandler);
router.get("/customer-360", listWalletCustomer360Handler);
router.get("/customer-360/:customerId", getWalletCustomer360DetailHandler);
router.get("/insights-alerts", getWalletInsightsAlertsHandler);
router.get("/visa-analytics", getWalletVisaAnalyticsHandler);

export default router;
