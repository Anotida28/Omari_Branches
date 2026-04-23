export const ExpenseType = {
  RENT: "RENT",
  ZESA: "ZESA",
  WIFI: "WIFI",
  OTHER: "OTHER",
} as const;

export type ExpenseType = string;

export const ExpenseStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  OVERDUE: "OVERDUE",
} as const;

export type ExpenseStatus = string;

export const DocumentType = {
  INVOICE: "INVOICE",
  RECEIPT: "RECEIPT",
  OTHER: "OTHER",
} as const;

export type DocumentType = string;

export const AlertRuleType = {
  DUE_REMINDER: "DUE_REMINDER",
  OVERDUE_ESCALATION: "OVERDUE_ESCALATION",
} as const;

export type AlertRuleType = string;

export const AlertSendStatus = {
  SENT: "SENT",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
  PENDING: "PENDING",
} as const;

export type AlertSendStatus = string;

export const UserRole = {
  VIEWER: "VIEWER",
  FULL_ACCESS: "FULL_ACCESS",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type UserRole = string;

export function isUserRole(value: unknown): value is UserRole {
  return value === UserRole.VIEWER || value === UserRole.FULL_ACCESS || value === UserRole.SUPER_ADMIN;
}