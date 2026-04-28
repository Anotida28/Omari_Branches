import { Router } from "express";

import {
  createRecurringReminderHandler,
  deleteRecurringReminderHandler,
  getRecurringReminderByIdHandler,
  listRecurringRemindersHandler,
  updateRecurringReminderHandler,
} from "../controllers/recurring-reminders.controller";

const router = Router();

router.post("/", createRecurringReminderHandler);
router.get("/", listRecurringRemindersHandler);
router.get("/:id", getRecurringReminderByIdHandler);
router.patch("/:id", updateRecurringReminderHandler);
router.delete("/:id", deleteRecurringReminderHandler);

export default router;
