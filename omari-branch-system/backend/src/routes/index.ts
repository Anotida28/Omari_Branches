import { Router } from "express";
import branchesRoutes from "./branches.routes";
import documentsRoutes from "./documents.routes";
import expensesRoutes from "./expenses.routes";
import metricsRoutes from "./metrics.routes";
import paymentsRoutes from "./payments.routes";

const router = Router();

router.use("/branches", branchesRoutes);
router.use("/documents", documentsRoutes);
router.use("/expenses", expensesRoutes);
router.use("/metrics", metricsRoutes);
router.use("/payments", paymentsRoutes);

export default router;
