import { Router } from "express";

import {
  createExpenseHandler,
  deleteExpenseHandler,
  getExpenseByIdHandler,
  listExpensesHandler,
  updateExpenseHandler,
} from "../controllers/expenses.controller";

const router = Router();

router.post("/", createExpenseHandler);
router.get("/", listExpensesHandler);
router.get("/:id", getExpenseByIdHandler);
router.patch("/:id", updateExpenseHandler);
router.delete("/:id", deleteExpenseHandler);

export default router;
