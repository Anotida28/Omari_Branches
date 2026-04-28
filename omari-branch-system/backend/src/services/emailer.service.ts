import { Prisma, type EmailLog, type EmailRecipient, type EmailSubscription } from "@prisma/client";

import { prisma } from "../db/prisma";

export const EmailType = {
  REMINDER: "REMINDER",
  DAILY_BRANCH_REPORT: "DAILY_BRANCH_REPORT",
  DAILY_WALLET_REPORT: "DAILY_WALLET_REPORT",
} as const;

export type EmailTypeValue = (typeof EmailType)[keyof typeof EmailType];

export const EmailSendStatus = {
  SENT: "SENT",
  FAILED: "FAILED",
  SKIPPED: "SKIPPED",
} as const;

export type EmailSendStatusValue = (typeof EmailSendStatus)[keyof typeof EmailSendStatus];

export class EmailerServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "EmailerServiceError";
  }
}

export type EmailRecipientResponse = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  subscriptions: EmailSubscriptionResponse[];
  createdAt: string;
  updatedAt: string;
};

export type EmailSubscriptionResponse = {
  id: string;
  emailType: EmailTypeValue;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
};

export type EmailRecipientCreateInput = {
  email: string;
  name?: string;
  isActive?: boolean;
  receivesReminders?: boolean;
  receivesDailyReports?: boolean;
  reportBranchIds?: Array<string | bigint | null>;
};

export type EmailRecipientUpdateInput = Partial<EmailRecipientCreateInput>;

export type EmailRecipientForSend = {
  id: bigint;
  email: string;
  name: string | null;
  branchId: bigint | null;
};

export type EmailLogCreateInput = {
  emailType: EmailTypeValue;
  recipientId?: bigint | null;
  sentTo: string;
  subject: string;
  status: EmailSendStatusValue;
  errorMessage?: string | null;
  branchId?: bigint | null;
  expenseId?: bigint | null;
  recurringReminderId?: bigint | null;
  reportDate?: Date | null;
  metadata?: string | null;
};


type RecipientWithSubscriptions = EmailRecipient & {
  subscriptions: Array<EmailSubscription & {
    branch: { id: bigint; city: string; label: string } | null;
  }>;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function formatDateTime(date: Date): string {
  return date.toISOString();
}

function normalizeBranchScope(values: Array<string | bigint | null> | undefined): Array<bigint | null> {
  if (!values || values.length === 0) {
    return [null];
  }

  const normalized = new Map<string, bigint | null>();
  for (const value of values) {
    if (value === null || value === "" || value === "all") {
      normalized.set("all", null);
      continue;
    }
    const branchId = typeof value === "bigint" ? value : BigInt(String(value));
    normalized.set(branchId.toString(), branchId);
  }

  return [...normalized.values()];
}

function toSubscriptionResponse(
  subscription: EmailSubscription & {
    branch?: { id: bigint; city: string; label: string } | null;
  },
): EmailSubscriptionResponse {
  return {
    id: subscription.id.toString(),
    emailType: subscription.emailType as EmailTypeValue,
    branchId: subscription.branchId?.toString() ?? null,
    branchName: subscription.branch
      ? `${subscription.branch.city} - ${subscription.branch.label}`
      : null,
    isActive: subscription.isActive,
  };
}

function toRecipientResponse(recipient: RecipientWithSubscriptions): EmailRecipientResponse {
  return {
    id: recipient.id.toString(),
    email: recipient.email,
    name: recipient.name,
    isActive: recipient.isActive,
    subscriptions: recipient.subscriptions.map(toSubscriptionResponse),
    createdAt: formatDateTime(recipient.createdAt),
    updatedAt: formatDateTime(recipient.updatedAt),
  };
}

async function syncSubscription(
  tx: Prisma.TransactionClient,
  recipientId: bigint,
  emailType: EmailTypeValue,
  enabled: boolean | undefined,
  branchIds?: Array<string | bigint | null>,
): Promise<void> {
  if (enabled === undefined && branchIds === undefined) {
    return;
  }

  if (enabled === false) {
    await tx.emailSubscription.deleteMany({
      where: { recipientId, emailType },
    });
    return;
  }

  const scopes = emailType === EmailType.DAILY_BRANCH_REPORT
    ? normalizeBranchScope(branchIds)
    : [null];

  await tx.emailSubscription.deleteMany({
    where: { recipientId, emailType },
  });

  for (const branchId of scopes) {
    await tx.emailSubscription.create({
      data: {
        recipientId,
        emailType,
        branchId,
        isActive: true,
      },
    });
  }
}

async function fetchRecipientById(id: bigint): Promise<EmailRecipientResponse | null> {
  const recipient = await prisma.emailRecipient.findUnique({
    where: { id },
    include: {
      subscriptions: {
        orderBy: [{ emailType: "asc" }, { branchId: "asc" }],
        include: {
          branch: { select: { id: true, city: true, label: true } },
        },
      },
    },
  });

  return recipient ? toRecipientResponse(recipient) : null;
}

export async function listEmailRecipients(): Promise<EmailRecipientResponse[]> {
  await ensureEmailRecipientsMigrated();

  const recipients = await prisma.emailRecipient.findMany({
    orderBy: [{ isActive: "desc" }, { email: "asc" }],
    include: {
      subscriptions: {
        orderBy: [{ emailType: "asc" }, { branchId: "asc" }],
        include: {
          branch: { select: { id: true, city: true, label: true } },
        },
      },
    },
  });

  return recipients.map(toRecipientResponse);
}

export async function createEmailRecipient(
  input: EmailRecipientCreateInput,
): Promise<EmailRecipientResponse> {
  const email = normalizeEmail(input.email);
  if (!validateEmail(email)) {
    throw new EmailerServiceError("Invalid email format", 400);
  }

  const existing = await prisma.emailRecipient.findUnique({ where: { email } });
  if (existing) {
    throw new EmailerServiceError("An email recipient with this email already exists", 409);
  }

  const recipientId = await prisma.$transaction(async (tx) => {
    const recipient = await tx.emailRecipient.create({
      data: {
        email,
        name: input.name?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });

    await syncSubscription(tx, recipient.id, EmailType.REMINDER, input.receivesReminders ?? true);
    await syncSubscription(
      tx,
      recipient.id,
      EmailType.DAILY_BRANCH_REPORT,
      input.receivesDailyReports ?? false,
      input.reportBranchIds,
    );

    return recipient.id;
  });

  const recipient = await fetchRecipientById(recipientId);
  if (!recipient) {
    throw new EmailerServiceError("Failed to load created recipient", 500);
  }
  return recipient;
}

export async function updateEmailRecipient(
  id: bigint,
  input: EmailRecipientUpdateInput,
): Promise<EmailRecipientResponse | null> {
  const existing = await prisma.emailRecipient.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  const data: Prisma.EmailRecipientUpdateInput = {};

  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);
    if (!validateEmail(email)) {
      throw new EmailerServiceError("Invalid email format", 400);
    }
    if (email !== existing.email) {
      const duplicate = await prisma.emailRecipient.findUnique({ where: { email } });
      if (duplicate) {
        throw new EmailerServiceError("An email recipient with this email already exists", 409);
      }
    }
    data.email = email;
  }

  if (input.name !== undefined) {
    data.name = input.name.trim() || null;
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.emailRecipient.update({ where: { id }, data });
    }
    await syncSubscription(tx, id, EmailType.REMINDER, input.receivesReminders);
    await syncSubscription(
      tx,
      id,
      EmailType.DAILY_BRANCH_REPORT,
      input.receivesDailyReports,
      input.reportBranchIds,
    );
  });

  return fetchRecipientById(id);
}

export async function deleteEmailRecipient(id: bigint): Promise<boolean> {
  try {
    await prisma.emailRecipient.delete({ where: { id } });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return false;
    }
    throw error;
  }
}

export async function getRecipientsForEmailType(
  emailType: EmailTypeValue,
): Promise<EmailRecipientForSend[]> {
  await ensureEmailRecipientsMigrated();

  const subscriptions = await prisma.emailSubscription.findMany({
    where: {
      emailType,
      isActive: true,
      recipient: { isActive: true },
    },
    include: {
      recipient: true,
    },
    orderBy: [
      { branchId: "asc" },
      { recipient: { email: "asc" } },
    ],
  });

  return subscriptions.map((subscription) => ({
    id: subscription.recipient.id,
    email: subscription.recipient.email,
    name: subscription.recipient.name,
    branchId: subscription.branchId,
  }));
}

export async function getActiveReminderRecipientEmails(): Promise<string[]> {
  const recipients = await getRecipientsForEmailType(EmailType.REMINDER);
  return [...new Set(recipients.map((recipient) => recipient.email))];
}

export async function createEmailLog(input: EmailLogCreateInput): Promise<EmailLog> {
  return prisma.emailLog.create({
    data: {
      emailType: input.emailType,
      recipientId: input.recipientId ?? null,
      sentTo: input.sentTo,
      subject: input.subject,
      status: input.status,
      errorMessage: input.errorMessage?.slice(0, 500) ?? null,
      branchId: input.branchId ?? null,
      expenseId: input.expenseId ?? null,
      recurringReminderId: input.recurringReminderId ?? null,
      reportDate: input.reportDate ?? null,
      metadata: input.metadata?.slice(0, 1000) ?? null,
    },
  });
}


let migrationPromise: Promise<void> | null = null;

export async function ensureEmailRecipientsMigrated(): Promise<void> {
  if (!migrationPromise) {
    migrationPromise = migrateReminderRecipients();
  }
  return migrationPromise;
}

async function migrateReminderRecipients(): Promise<void> {
  const existingEmailRecipientCount = await prisma.emailRecipient.count();
  if (existingEmailRecipientCount > 0) {
    return;
  }

  const reminderRecipients = await prisma.reminderRecipient.findMany();
  for (const reminderRecipient of reminderRecipients) {
    await prisma.$transaction(async (tx) => {
      const recipient = await tx.emailRecipient.upsert({
        where: { email: reminderRecipient.email },
        update: {
          name: reminderRecipient.name,
          isActive: reminderRecipient.isActive,
        },
        create: {
          email: reminderRecipient.email,
          name: reminderRecipient.name,
          isActive: reminderRecipient.isActive,
        },
      });

      const existingSubscription = await tx.emailSubscription.findFirst({
        where: {
          recipientId: recipient.id,
          emailType: EmailType.REMINDER,
          branchId: null,
        },
      });

      if (existingSubscription) {
        await tx.emailSubscription.update({
          where: { id: existingSubscription.id },
          data: { isActive: reminderRecipient.isActive },
        });
      } else {
        await tx.emailSubscription.create({
          data: {
            recipientId: recipient.id,
            emailType: EmailType.REMINDER,
            branchId: null,
            isActive: reminderRecipient.isActive,
          },
        });
      }
    });
  }
}
