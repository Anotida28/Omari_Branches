import { Router } from "express";

import { deletePaymentHandler } from "../controllers/payments.controller";
import { listPaymentDocumentsHandler } from "../controllers/documents.controller";

const router = Router();

router.get("/:id/documents", listPaymentDocumentsHandler);
router.delete("/:id", deletePaymentHandler);

export default router;
