export type ReminderState = "UPCOMING" | "DUE_TODAY" | "OVERDUE";

function toUtcDateOnly(value: string | Date): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

export function getReminderState(
  dueDate: string | Date,
  now: Date = new Date(),
): ReminderState {
  const due = toUtcDateOnly(dueDate);
  const today = toUtcDateOnly(now);

  if (due.getTime() < today.getTime()) {
    return "OVERDUE";
  }

  if (due.getTime() === today.getTime()) {
    return "DUE_TODAY";
  }

  return "UPCOMING";
}

export function isReminderOverdue(
  dueDate: string | Date,
  now: Date = new Date(),
): boolean {
  return getReminderState(dueDate, now) === "OVERDUE";
}

export function isReminderDueWithinDays(
  dueDate: string | Date,
  days: number,
  now: Date = new Date(),
): boolean {
  const due = toUtcDateOnly(dueDate);
  const today = toUtcDateOnly(now);
  const limit = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

  return due.getTime() >= today.getTime() && due.getTime() <= limit.getTime();
}
