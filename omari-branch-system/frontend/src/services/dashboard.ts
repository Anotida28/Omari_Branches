import { listBranches } from "./branches";
import { listExpenses } from "./expenses";
import { toMoneyNumber } from "./format";
import type { DashboardStats } from "../types/api";

async function fetchOutstandingBalance(): Promise<number> {
  const pageSize = 100;
  let page = 1;
  let total = 0;
  let outstanding = 0;

  do {
    const response = await listExpenses({ page, pageSize });
    total = response.total;

    for (const item of response.items) {
      outstanding += toMoneyNumber(item.balanceRemaining);
    }

    page += 1;
  } while ((page - 1) * pageSize < total);

  return outstanding;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [branches, expenses, overdue, totalOutstandingBalance] =
    await Promise.all([
      listBranches({ page: 1, pageSize: 1 }),
      listExpenses({ page: 1, pageSize: 1 }),
      listExpenses({ status: "OVERDUE", page: 1, pageSize: 1 }),
      fetchOutstandingBalance(),
    ]);

  return {
    totalBranches: branches.total,
    totalExpenses: expenses.total,
    overdueExpenses: overdue.total,
    totalOutstandingBalance,
  };
}
