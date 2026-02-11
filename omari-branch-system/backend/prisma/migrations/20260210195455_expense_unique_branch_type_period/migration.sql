/*
  Warnings:

  - A unique constraint covering the columns `[branchId,expenseType,period]` on the table `Expense` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `Expense_branchId_expenseType_period_key` ON `Expense`(`branchId`, `expenseType`, `period`);
