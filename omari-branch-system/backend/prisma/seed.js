"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const crypto_1 = require("node:crypto");
const prisma = new client_1.PrismaClient();
const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
function hashPassword(password) {
    if (!password) {
        throw new Error("Password is required");
    }
    const salt = (0, crypto_1.randomBytes)(SALT_LENGTH);
    const hash = (0, crypto_1.scryptSync)(password, salt, KEY_LENGTH, {
        N: COST,
        r: BLOCK_SIZE,
        p: PARALLELIZATION,
    });
    return `${HASH_PREFIX}$${salt.toString("hex")}$${hash.toString("hex")}`;
}
function todayDateOnly() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
async function seedUsers() {
    const users = [
        {
            username: "admin",
            password: "admin123",
            role: "FULL_ACCESS",
        },
        {
            username: "viewer",
            password: "viewer123",
            role: "VIEWER",
        },
    ];
    for (const user of users) {
        await prisma.user.upsert({
            where: { username: user.username },
            update: {
                passwordHash: hashPassword(user.password),
                role: user.role,
                isActive: true,
            },
            create: {
                username: user.username,
                passwordHash: hashPassword(user.password),
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
        { city: "Mutare", label: "East" }
    ];
    for (const b of branches) {
        await prisma.branch.upsert({
            where: {
                city_label: {
                    city: b.city,
                    label: b.label
                }
            },
            update: {},
            create: b
        });
    }
    const allBranches = await prisma.branch.findMany();
    const today = todayDateOnly();
    const currentPeriod = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
    for (const branch of allBranches) {
        await prisma.branchMetric.upsert({
            where: {
                uq_branch_date: {
                    branchId: branch.id,
                    metricDate: today
                }
            },
            update: {},
            create: {
                branchId: branch.id,
                metricDate: today,
                cashBalance: 0,
                eFloatBalance: 0,
                cashInVault: 0,
                cashInVolume: 0,
                cashInValue: 0,
                cashOutVolume: 0,
                cashOutValue: 0
            }
        });
        const existingExpense = await prisma.expense.findFirst({
            where: {
                branchId: branch.id,
                period: currentPeriod,
                expenseType: "RENT"
            }
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
                    vendor: "Default Landlord"
                }
            });
        }
    }
    const ruleOffsets = [
        { ruleType: "DUE_REMINDER", dayOffset: -7 },
        { ruleType: "DUE_REMINDER", dayOffset: -3 },
        { ruleType: "DUE_REMINDER", dayOffset: -1 },
        { ruleType: "OVERDUE_ESCALATION", dayOffset: 1 },
        { ruleType: "OVERDUE_ESCALATION", dayOffset: 7 },
        { ruleType: "OVERDUE_ESCALATION", dayOffset: 14 }
    ];
    for (const rule of ruleOffsets) {
        await prisma.alertRule.upsert({
            where: {
                uq_rule_type_offset: {
                    ruleType: rule.ruleType,
                    dayOffset: rule.dayOffset
                }
            },
            update: {},
            create: rule
        });
    }
    console.log("Seed completed successfully.");
    console.log("Seeded users: admin/admin123 (FULL_ACCESS), viewer/viewer123 (VIEWER)");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
