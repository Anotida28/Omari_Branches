import { Router } from "express";

import {
  createRecipientHandler,
  deleteRecipientHandler,
  getRecipientHandler,
  listRecipientsHandler,
  updateRecipientHandler,
} from "../controllers/recipients.controller";

const router = Router();

router.get("/", listRecipientsHandler);
router.post("/", createRecipientHandler);
router.get("/:recipientId", getRecipientHandler);
router.patch("/:recipientId", updateRecipientHandler);
router.delete("/:recipientId", deleteRecipientHandler);

export default router;
