import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function todayDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function seedUsers() {
  const users = [
    {
      username: "admin",
      role: "FULL_ACCESS" as const,
    },
    {
      username: "viewer",
      role: "VIEWER" as const,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        role: user.role,
        isActive: true,
      },
      create: {
        username: user.username,
        role: user.role,
        isActive: true,
      },
    });
  }
}

async function main() {
  await seedUsers();

  const branches = [
    { city: "Harare", label: "HQ" },
    { city: "Bulawayo", label: "Central" },
    { city: "Mutare", label: "East" },
  ];

  for (const b of branches) {
    await prisma.branch.upsert({
      where: {
        city_label: {
          city: b.city,
          label: b.label,
        },
      },
      update: {},
      create: b,
    });
  }

  const allBranches = await prisma.branch.findMany();

  const today = todayDateOnly();
  const currentPeriod = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;

  for (const branch of allBranches) {
    const existingExpense = await prisma.expense.findFirst({
      where: {
        branchId: branch.id,
        period: currentPeriod,
        expenseType: "RENT",
      },
    });

    if (!existingExpense) {
      await prisma.expense.create({
        data: {
          branchId: branch.id,
          expenseType: "RENT",
          period: currentPeriod,
          dueDate: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
          amount: 1000,
          currency: "USD",
          vendor: "Default Landlord",
        },
      });
    }
  }

  const ruleOffsets = [
    { ruleType: "DUE_REMINDER", dayOffset: -7 },
    { ruleType: "DUE_REMINDER", dayOffset: -3 },
    { ruleType: "DUE_REMINDER", dayOffset: -1 },
    { ruleType: "OVERDUE_ESCALATION", dayOffset: 1 },
    { ruleType: "OVERDUE_ESCALATION", dayOffset: 7 },
    { ruleType: "OVERDUE_ESCALATION", dayOffset: 14 },
  ];

  for (const rule of ruleOffsets) {
    await prisma.alertRule.upsert({
      where: {
        uq_rule_type_offset: {
          ruleType: rule.ruleType as any,
          dayOffset: rule.dayOffset,
        },
      },
      update: {},
      create: rule as any,
    });
  }

  console.log("Seed completed successfully.");
  console.log("Seeded user profiles: admin (FULL_ACCESS), viewer (VIEWER).");
  console.log("These accounts must still authenticate through the external auth service.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


