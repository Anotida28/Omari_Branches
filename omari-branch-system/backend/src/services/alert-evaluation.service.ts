/**
 * Alert Evaluation Service
 *
 * Phase 0: Pure functions for alert candidate evaluation.
 * No side effects, no database writes, no email sending.
 *
 * Key concepts:
 * - Alert Key: expenseId + ruleId + triggerDate (prevents duplicate alerts)
 * - Eligible Expense: status != PAID, has dueDate, balanceRemaining > 0
 * - Timezone: Africa/Harare (UTC+2) for "today" calculation
 */

import type { AlertRuleType, ExpenseStatus, ExpenseType } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

/**
 * Minimal expense data needed for alert evaluation.
 * This is a projection of the Expense model to keep the function pure.
 */
export type EligibleExpenseInput = {
  id: bigint;
  branchId: bigint;
  expenseType: ExpenseType;
  period: string;
  dueDate: Date;
  amount: string | number; // Decimal as string or number
  status: ExpenseStatus;
  balanceRemaining: string | number; // Computed: amount - totalPaid
};

/**
 * Alert rule configuration.
 */
export type AlertRuleInput = {
  id: bigint;
  ruleType: AlertRuleType;
  dayOffset: number;
  isActive: boolean;
};

/**
 * An alert candidate ready to be processed (logged, emailed, etc.)
 */
export type AlertCandidate = {
  /** Unique key to prevent duplicate alerts: "{expenseId}:{ruleId}:{triggerDate}" */
  alertKey: string;

  /** The expense that triggered this alert */
  expenseId: bigint;
  branchId: bigint;
  expenseType: ExpenseType;
  period: string;
  dueDate: Date;
  balanceRemaining: number;

  /** The rule that matched */
  ruleId: bigint;
  ruleType: AlertRuleType;
  dayOffset: number;

  /** The date this alert should be triggered (today in Africa/Harare) */
  triggerDate: string; // YYYY-MM-DD format

  /** Days until due (negative = overdue) */
  daysToDue: number;
};

/**
 * Result of evaluating alerts.
 */
export type AlertEvaluationResult = {
  /** Date used for evaluation (Africa/Harare timezone) */
  evaluationDate: string;

  /** Timezone used */
  timezone: string;

  /** Total expenses evaluated */
  totalExpensesEvaluated: number;

  /** Expenses that were eligible (not paid, has dueDate) */
  eligibleExpenseCount: number;

  /** Alert candidates that matched rules */
  candidates: AlertCandidate[];
};

// ============================================================================
// Constants
// ============================================================================

/** Zimbabwe timezone (UTC+2, no DST) */
export const TIMEZONE_HARARE = "Africa/Harare";

/** Offset in minutes for Africa/Harare (UTC+2 = +120 minutes) */
const HARARE_OFFSET_MINUTES = 120;

// ============================================================================
// Pure Functions
// ============================================================================

/**
 * Get "today" in Africa/Harare timezone as a Date (midnight UTC representation).
 * 
 * @param now - The current moment (defaults to Date.now())
 * @returns Date object representing midnight of "today" in Harare
 */
export function getTodayInHarare(now: Date = new Date()): Date {
  // Get UTC time
  const utcTime = now.getTime();
  
  // Add Harare offset to get local time
  const harareTime = new Date(utcTime + HARARE_OFFSET_MINUTES * 60 * 1000);
  
  // Extract year, month, day in Harare time
  const year = harareTime.getUTCFullYear();
  const month = harareTime.getUTCMonth();
  const day = harareTime.getUTCDate();
  
  // Return midnight UTC for that Harare date
  return new Date(Date.UTC(year, month, day));
}

/**
 * Format a date as YYYY-MM-DD string.
 */
export function formatDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Calculate the number of days between two dates (ignoring time).
 * Positive = future, Negative = past.
 * 
 * @param fromDate - The reference date (e.g., today)
 * @param toDate - The target date (e.g., dueDate)
 * @returns Number of days (toDate - fromDate)
 */
export function daysBetween(fromDate: Date, toDate: Date): number {
  // Normalize both dates to midnight UTC
  const from = Date.UTC(
    fromDate.getUTCFullYear(),
    fromDate.getUTCMonth(),
    fromDate.getUTCDate()
  );
  const to = Date.UTC(
    toDate.getUTCFullYear(),
    toDate.getUTCMonth(),
    toDate.getUTCDate()
  );
  
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to - from) / msPerDay);
}

/**
 * Generate a unique alert key to prevent duplicate alerts.
 * 
 * Format: "{expenseId}:{ruleId}:{triggerDate}"
 * 
 * This ensures:
 * - Same expense + same rule + same day = only one alert
 * - Re-running evaluation on same day won't create duplicates
 */
export function generateAlertKey(
  expenseId: bigint,
  ruleId: bigint,
  triggerDate: string
): string {
  return `${expenseId.toString()}:${ruleId.toString()}:${triggerDate}`;
}

/**
 * Parse a balance value to number.
 */
function toNumber(value: string | number): number {
  if (typeof value === "number") {
    return value;
  }
  return parseFloat(value) || 0;
}

/**
 * Check if an expense is eligible for alert evaluation.
 * 
 * Criteria:
 * - status != PAID
 * - balanceRemaining > 0
 * - has a valid dueDate
 */
export function isExpenseEligible(expense: EligibleExpenseInput): boolean {
  // Must not be fully paid
  if (expense.status === "PAID") {
    return false;
  }
  
  // Must have remaining balance
  const balance = toNumber(expense.balanceRemaining);
  if (balance <= 0) {
    return false;
  }
  
  // Must have a valid dueDate
  if (!expense.dueDate || !(expense.dueDate instanceof Date)) {
    return false;
  }
  
  if (Number.isNaN(expense.dueDate.getTime())) {
    return false;
  }
  
  return true;
}

/**
 * Check if a rule matches the given daysToDue value.
 * 
 * - DUE_REMINDER rules: match when daysToDue equals the (negative) offset
 *   e.g., dayOffset -7 matches when dueDate is 7 days away (daysToDue = 7)
 * 
 * - OVERDUE_ESCALATION rules: match when expense is overdue by offset days
 *   e.g., dayOffset +1 matches when dueDate was 1 day ago (daysToDue = -1)
 */
export function doesRuleMatch(
  rule: AlertRuleInput,
  daysToDue: number
): boolean {
  if (!rule.isActive) {
    return false;
  }
  
  if (rule.ruleType === "DUE_REMINDER") {
    // DUE_REMINDER: dayOffset is negative (e.g., -7 means 7 days before)
    // daysToDue is positive when due date is in the future
    // Match when: daysToDue === abs(dayOffset)
    // e.g., dayOffset=-7, daysToDue=7 -> match (7 days until due)
    return daysToDue === Math.abs(rule.dayOffset);
  }
  
  if (rule.ruleType === "OVERDUE_ESCALATION") {
    // OVERDUE_ESCALATION: dayOffset is positive (e.g., +1 means 1 day after)
    // daysToDue is negative when overdue
    // Match when: abs(daysToDue) === dayOffset AND daysToDue < 0
    // e.g., dayOffset=1, daysToDue=-1 -> match (1 day overdue)
    return daysToDue < 0 && Math.abs(daysToDue) === rule.dayOffset;
  }
  
  return false;
}

/**
 * Main evaluation function.
 * 
 * Takes a list of expenses and rules, returns alert candidates
 * that should be processed (sent, logged, etc.)
 * 
 * This is a PURE function with no side effects.
 * 
 * @param today - The evaluation date (should be "today" in Africa/Harare)
 * @param expenses - List of expenses to evaluate
 * @param rules - List of active alert rules
 * @returns AlertEvaluationResult with candidates
 */
export function evaluateAlerts(
  today: Date,
  expenses: EligibleExpenseInput[],
  rules: AlertRuleInput[]
): AlertEvaluationResult {
  const triggerDate = formatDateString(today);
  const candidates: AlertCandidate[] = [];
  
  // Filter to only active rules
  const activeRules = rules.filter((rule) => rule.isActive);
  
  // Track eligible expenses
  let eligibleExpenseCount = 0;
  
  for (const expense of expenses) {
    // Skip ineligible expenses
    if (!isExpenseEligible(expense)) {
      continue;
    }
    
    eligibleExpenseCount++;
    
    // Calculate days until due
    const daysToDue = daysBetween(today, expense.dueDate);
    
    // Check each rule
    for (const rule of activeRules) {
      if (doesRuleMatch(rule, daysToDue)) {
        const alertKey = generateAlertKey(expense.id, rule.id, triggerDate);
        
        candidates.push({
          alertKey,
          expenseId: expense.id,
          branchId: expense.branchId,
          expenseType: expense.expenseType,
          period: expense.period,
          dueDate: expense.dueDate,
          balanceRemaining: toNumber(expense.balanceRemaining),
          ruleId: rule.id,
          ruleType: rule.ruleType,
          dayOffset: rule.dayOffset,
          triggerDate,
          daysToDue,
        });
      }
    }
  }
  
  return {
    evaluationDate: triggerDate,
    timezone: TIMEZONE_HARARE,
    totalExpensesEvaluated: expenses.length,
    eligibleExpenseCount,
    candidates,
  };
}

// ============================================================================
// Helper: Fetch data and evaluate (combines pure function with data access)
// ============================================================================

/**
 * Convenience wrapper that evaluates alerts using "now" in Africa/Harare.
 * Still a pure function - just uses current time as default.
 */
export function evaluateAlertsNow(
  expenses: EligibleExpenseInput[],
  rules: AlertRuleInput[]
): AlertEvaluationResult {
  const today = getTodayInHarare();
  return evaluateAlerts(today, expenses, rules);
}
