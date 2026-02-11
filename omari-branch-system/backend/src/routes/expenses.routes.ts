import { Router } from "express";

import {
  createExpenseHandler,
  deleteExpenseHandler,
  getExpenseByIdHandler,
  listExpensesHandler,
  updateExpenseHandler,
} from "../controllers/expenses.controller";
import {
  createPaymentHandler,
  listPaymentsForExpenseHandler,
} from "../controllers/payments.controller";
import { listExpenseDocumentsHandler } from "../controllers/documents.controller";

const router = Router();

router.post("/", createExpenseHandler);
router.get("/", listExpensesHandler);
router.get("/:id", getExpenseByIdHandler);
router.patch("/:id", updateExpenseHandler);
router.delete("/:id", deleteExpenseHandler);

router.post("/:id/payments", createPaymentHandler);
router.get("/:id/payments", listPaymentsForExpenseHandler);
router.get("/:id/documents", listExpenseDocumentsHandler);

export default router;
