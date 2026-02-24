/**
 * Alert Evaluation Tests
 * 
 * Run with: npx ts-node src/services/alert-evaluation.test.ts
 */

import {
  daysBetween,
  doesRuleMatch,
  evaluateAlerts,
  formatDateString,
  generateAlertKey,
  getTodayInHarare,
  isExpenseEligible,
  type AlertRuleInput,
  type EligibleExpenseInput,
} from "./alert-evaluation.service";

// ============================================================================
// Test Utilities
// ============================================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   ${(error as Error).message}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `${message ? message + ": " : ""}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertArrayLength(arr: unknown[], expected: number, message?: string) {
  if (arr.length !== expected) {
    throw new Error(
      `${message ? message + ": " : ""}Expected array length ${expected}, got ${arr.length}`
    );
  }
}

// ============================================================================
// Test Data Factories
// ============================================================================

function makeExpense(overrides: Partial<EligibleExpenseInput> = {}): EligibleExpenseInput {
  return {
    id: BigInt(1),
    branchId: BigInt(1),
    expenseType: "RENT",
    period: "2026-02",
    dueDate: new Date(Date.UTC(2026, 1, 27)), // Feb 27, 2026
    amount: "1000",
    status: "PENDING",
    balanceRemaining: "1000",
    ...overrides,
  };
}

function makeRule(overrides: Partial<AlertRuleInput> = {}): AlertRuleInput {
  return {
    id: BigInt(1),
    ruleType: "DUE_REMINDER",
    dayOffset: -7,
    isActive: true,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

console.log("\n=== Alert Evaluation Tests ===\n");

// --- formatDateString ---
test("formatDateString formats date correctly", () => {
  const date = new Date(Date.UTC(2026, 1, 20)); // Feb 20, 2026
  assertEqual(formatDateString(date), "2026-02-20");
});

// --- daysBetween ---
test("daysBetween returns 0 for same day", () => {
  const date = new Date(Date.UTC(2026, 1, 20));
  assertEqual(daysBetween(date, date), 0);
});

test("daysBetween returns positive for future date", () => {
  const from = new Date(Date.UTC(2026, 1, 20)); // Feb 20
  const to = new Date(Date.UTC(2026, 1, 27)); // Feb 27
  assertEqual(daysBetween(from, to), 7);
});

test("daysBetween returns negative for past date", () => {
  const from = new Date(Date.UTC(2026, 1, 20)); // Feb 20
  const to = new Date(Date.UTC(2026, 1, 13)); // Feb 13
  assertEqual(daysBetween(from, to), -7);
});

// --- generateAlertKey ---
test("generateAlertKey creates unique key", () => {
  const key = generateAlertKey(BigInt(123), BigInt(456), "2026-02-20");
  assertEqual(key, "123:456:2026-02-20");
});

// --- isExpenseEligible ---
test("isExpenseEligible returns true for pending expense with balance", () => {
  const expense = makeExpense({ status: "PENDING", balanceRemaining: "500" });
  assertEqual(isExpenseEligible(expense), true);
});

test("isExpenseEligible returns true for overdue expense with balance", () => {
  const expense = makeExpense({ status: "OVERDUE", balanceRemaining: "500" });
  assertEqual(isExpenseEligible(expense), true);
});

test("isExpenseEligible returns false for PAID expense", () => {
  const expense = makeExpense({ status: "PAID", balanceRemaining: "0" });
  assertEqual(isExpenseEligible(expense), false);
});

test("isExpenseEligible returns false for zero balance", () => {
  const expense = makeExpense({ status: "PENDING", balanceRemaining: "0" });
  assertEqual(isExpenseEligible(expense), false);
});

test("isExpenseEligible returns false for negative balance", () => {
  const expense = makeExpense({ status: "PENDING", balanceRemaining: "-10" });
  assertEqual(isExpenseEligible(expense), false);
});

// --- doesRuleMatch ---
test("DUE_REMINDER matches when daysToDue equals abs(dayOffset)", () => {
  const rule = makeRule({ ruleType: "DUE_REMINDER", dayOffset: -7 });
  assertEqual(doesRuleMatch(rule, 7), true, "7 days until due");
  assertEqual(doesRuleMatch(rule, 6), false, "6 days until due");
  assertEqual(doesRuleMatch(rule, 8), false, "8 days until due");
});

test("DUE_REMINDER does not match when overdue", () => {
  const rule = makeRule({ ruleType: "DUE_REMINDER", dayOffset: -7 });
  assertEqual(doesRuleMatch(rule, -7), false, "7 days overdue");
});

test("OVERDUE_ESCALATION matches when overdue by dayOffset days", () => {
  const rule = makeRule({ ruleType: "OVERDUE_ESCALATION", dayOffset: 1 });
  assertEqual(doesRuleMatch(rule, -1), true, "1 day overdue");
  assertEqual(doesRuleMatch(rule, -2), false, "2 days overdue");
  assertEqual(doesRuleMatch(rule, 0), false, "due today");
});

test("OVERDUE_ESCALATION does not match before due", () => {
  const rule = makeRule({ ruleType: "OVERDUE_ESCALATION", dayOffset: 1 });
  assertEqual(doesRuleMatch(rule, 1), false, "1 day until due");
});

test("Inactive rule never matches", () => {
  const rule = makeRule({ isActive: false, dayOffset: -7 });
  assertEqual(doesRuleMatch(rule, 7), false);
});

// --- evaluateAlerts ---
test("evaluateAlerts returns empty for no matching rules", () => {
  const today = new Date(Date.UTC(2026, 1, 20)); // Feb 20
  const expenses = [
    makeExpense({ dueDate: new Date(Date.UTC(2026, 1, 25)) }), // 5 days away
  ];
  const rules = [makeRule({ dayOffset: -7 })]; // Only matches at 7 days

  const result = evaluateAlerts(today, expenses, rules);
  
  assertArrayLength(result.candidates, 0);
  assertEqual(result.eligibleExpenseCount, 1);
});

test("evaluateAlerts matches DUE_REMINDER correctly", () => {
  const today = new Date(Date.UTC(2026, 1, 20)); // Feb 20
  const expenses = [
    makeExpense({
      id: BigInt(100),
      dueDate: new Date(Date.UTC(2026, 1, 27)), // 7 days away
    }),
  ];
  const rules = [makeRule({ id: BigInt(1), dayOffset: -7 })];

  const result = evaluateAlerts(today, expenses, rules);
  
  assertArrayLength(result.candidates, 1);
  assertEqual(result.candidates[0].expenseId, BigInt(100));
  assertEqual(result.candidates[0].ruleId, BigInt(1));
  assertEqual(result.candidates[0].daysToDue, 7);
  assertEqual(result.candidates[0].triggerDate, "2026-02-20");
  assertEqual(result.candidates[0].alertKey, "100:1:2026-02-20");
});

test("evaluateAlerts matches OVERDUE_ESCALATION correctly", () => {
  const today = new Date(Date.UTC(2026, 1, 21)); // Feb 21
  const expenses = [
    makeExpense({
      id: BigInt(200),
      dueDate: new Date(Date.UTC(2026, 1, 20)), // 1 day overdue
      status: "OVERDUE",
    }),
  ];
  const rules = [
    makeRule({ id: BigInt(10), ruleType: "OVERDUE_ESCALATION", dayOffset: 1 }),
  ];

  const result = evaluateAlerts(today, expenses, rules);
  
  assertArrayLength(result.candidates, 1);
  assertEqual(result.candidates[0].expenseId, BigInt(200));
  assertEqual(result.candidates[0].ruleType, "OVERDUE_ESCALATION");
  assertEqual(result.candidates[0].daysToDue, -1);
});

test("evaluateAlerts matches multiple rules for same expense", () => {
  const today = new Date(Date.UTC(2026, 1, 28)); // Feb 28
  const expenses = [
    makeExpense({
      id: BigInt(300),
      dueDate: new Date(Date.UTC(2026, 1, 21)), // 7 days overdue
      status: "OVERDUE",
    }),
  ];
  const rules = [
    makeRule({ id: BigInt(1), ruleType: "OVERDUE_ESCALATION", dayOffset: 1 }),
    makeRule({ id: BigInt(2), ruleType: "OVERDUE_ESCALATION", dayOffset: 7 }),
    makeRule({ id: BigInt(3), ruleType: "OVERDUE_ESCALATION", dayOffset: 14 }),
  ];

  const result = evaluateAlerts(today, expenses, rules);
  
  // Only dayOffset=7 should match (7 days overdue)
  assertArrayLength(result.candidates, 1);
  assertEqual(result.candidates[0].ruleId, BigInt(2));
});

test("evaluateAlerts skips PAID expenses", () => {
  const today = new Date(Date.UTC(2026, 1, 20));
  const expenses = [
    makeExpense({
      dueDate: new Date(Date.UTC(2026, 1, 27)),
      status: "PAID",
      balanceRemaining: "0",
    }),
  ];
  const rules = [makeRule({ dayOffset: -7 })];

  const result = evaluateAlerts(today, expenses, rules);
  
  assertArrayLength(result.candidates, 0);
  assertEqual(result.eligibleExpenseCount, 0);
});

test("evaluateAlerts handles multiple expenses and rules", () => {
  const today = new Date(Date.UTC(2026, 1, 20)); // Feb 20
  const expenses = [
    makeExpense({
      id: BigInt(1),
      dueDate: new Date(Date.UTC(2026, 1, 27)), // 7 days away
    }),
    makeExpense({
      id: BigInt(2),
      dueDate: new Date(Date.UTC(2026, 1, 23)), // 3 days away
    }),
    makeExpense({
      id: BigInt(3),
      dueDate: new Date(Date.UTC(2026, 1, 21)), // 1 day away
    }),
    makeExpense({
      id: BigInt(4),
      dueDate: new Date(Date.UTC(2026, 1, 19)), // 1 day overdue
      status: "OVERDUE",
    }),
  ];
  const rules = [
    makeRule({ id: BigInt(1), ruleType: "DUE_REMINDER", dayOffset: -7 }),
    makeRule({ id: BigInt(2), ruleType: "DUE_REMINDER", dayOffset: -3 }),
    makeRule({ id: BigInt(3), ruleType: "DUE_REMINDER", dayOffset: -1 }),
    makeRule({ id: BigInt(4), ruleType: "OVERDUE_ESCALATION", dayOffset: 1 }),
  ];

  const result = evaluateAlerts(today, expenses, rules);
  
  // Expense 1 -> Rule 1 (7 days)
  // Expense 2 -> Rule 2 (3 days)
  // Expense 3 -> Rule 3 (1 day)
  // Expense 4 -> Rule 4 (1 day overdue)
  assertArrayLength(result.candidates, 4);
  assertEqual(result.eligibleExpenseCount, 4);
  assertEqual(result.totalExpensesEvaluated, 4);
});

// --- getTodayInHarare ---
test("getTodayInHarare returns correct date for UTC midnight", () => {
  // At UTC 00:00, it's 02:00 in Harare, so same day
  const utcMidnight = new Date(Date.UTC(2026, 1, 20, 0, 0, 0));
  const harareToday = getTodayInHarare(utcMidnight);
  assertEqual(formatDateString(harareToday), "2026-02-20");
});

test("getTodayInHarare handles UTC evening (next day in Harare)", () => {
  // At UTC 23:00, it's 01:00 next day in Harare
  const utcEvening = new Date(Date.UTC(2026, 1, 20, 23, 0, 0));
  const harareToday = getTodayInHarare(utcEvening);
  assertEqual(formatDateString(harareToday), "2026-02-21");
});

// ============================================================================
// Summary
// ============================================================================

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
