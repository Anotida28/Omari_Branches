import { Router } from "express";
import adminRoutes from "./admin.routes";
import alertLogsRoutes from "./alert-logs.routes";
import branchesRoutes from "./branches.routes";
import documentsRoutes from "./documents.routes";
import expensesRoutes from "./expenses.routes";
import metricsRoutes from "./metrics.routes";
import paymentsRoutes from "./payments.routes";
import recipientsRoutes from "./recipients.routes";

const router = Router();

router.use("/admin", adminRoutes);
router.use("/alerts", alertLogsRoutes);
router.use("/branches", branchesRoutes);
router.use("/documents", documentsRoutes);
router.use("/expenses", expensesRoutes);
router.use("/metrics", metricsRoutes);
router.use("/payments", paymentsRoutes);
router.use("/recipients", recipientsRoutes);

export default router;
