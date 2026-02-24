import { Router } from "express";

import {
  deleteRecipientHandler,
  getRecipientHandler,
  updateRecipientHandler,
} from "../controllers/recipients.controller";

const router = Router();

// Standalone recipient routes (by recipient ID)
router.get("/:recipientId", getRecipientHandler);
router.patch("/:recipientId", updateRecipientHandler);
router.delete("/:recipientId", deleteRecipientHandler);

export default router;
