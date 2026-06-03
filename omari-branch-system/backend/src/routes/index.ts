import { Router } from "express";
import adminRoutes from "./admin.routes";
import alertLogsRoutes from "./alert-logs.routes";
import branchesRoutes from "./branches.routes";
import emailLogsRoutes from "./email-logs.routes";
import expensesRoutes from "./expenses.routes";
import metricsRoutes from "./metrics.routes";
import recurringRemindersRoutes from "./recurring-reminders.routes";
import recipientsRoutes from "./recipients.routes";
import usersRoutes from "./users.routes";
import walletRoutes from "./wallet.routes";

const router = Router();

router.use("/admin", adminRoutes);
router.use("/alerts", alertLogsRoutes);
router.use("/branches", branchesRoutes);
router.use("/emails", emailLogsRoutes);
router.use("/expenses", expensesRoutes);
router.use("/metrics", metricsRoutes);
router.use("/recurring-reminders", recurringRemindersRoutes);
router.use("/recipients", recipientsRoutes);
router.use("/users", usersRoutes);
router.use("/wallet", walletRoutes);

export default router;
