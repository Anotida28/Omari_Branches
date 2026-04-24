import { Prisma, type ReminderRecipient } from "@prisma/client";

import { prisma } from "../db/prisma";

export class RecipientServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "RecipientServiceError";
  }
}

export type RecipientCreateInput = {
  email: string;
  name?: string;
  isActive?: boolean;
};

export type RecipientUpdateInput = {
  email?: string;
  name?: string;
  isActive?: boolean;
};

export type RecipientResponse = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function formatDateTime(date: Date): string {
  return date.toISOString();
}

function toRecipientResponse(recipient: ReminderRecipient): RecipientResponse {
  return {
    id: recipient.id.toString(),
    email: recipient.email,
    name: recipient.name ?? null,
    isActive: recipient.isActive,
    createdAt: formatDateTime(recipient.createdAt),
    updatedAt: formatDateTime(recipient.updatedAt),
  };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

export async function listRecipients(): Promise<RecipientResponse[]> {
  const recipients = await prisma.reminderRecipient.findMany({
    orderBy: [{ isActive: "desc" }, { email: "asc" }],
  });

  return recipients.map(toRecipientResponse);
}

export async function getRecipientById(id: bigint): Promise<RecipientResponse | null> {
  const recipient = await prisma.reminderRecipient.findUnique({
    where: { id },
  });

  return recipient ? toRecipientResponse(recipient) : null;
}

export async function createRecipient(
  input: RecipientCreateInput
): Promise<RecipientResponse> {
  const email = normalizeEmail(input.email);

  if (!validateEmail(email)) {
    throw new RecipientServiceError("Invalid email format", 400);
  }

  const existing = await prisma.reminderRecipient.findUnique({
    where: { email },
  });

  if (existing) {
    throw new RecipientServiceError(
      "A reminder recipient with this email already exists",
      409
    );
  }

  const data: Prisma.ReminderRecipientCreateInput = {
    email,
    name: input.name?.trim() || null,
    isActive: input.isActive ?? true,
  };

  const recipient = await prisma.reminderRecipient.create({ data });

  return toRecipientResponse(recipient);
}

export async function updateRecipient(
  id: bigint,
  input: RecipientUpdateInput
): Promise<RecipientResponse | null> {
  const existing = await prisma.reminderRecipient.findUnique({
    where: { id },
  });

  if (!existing) {
    return null;
  }

  const data: Prisma.ReminderRecipientUpdateInput = {};

  if (input.email !== undefined) {
    const email = normalizeEmail(input.email);

    if (!validateEmail(email)) {
      throw new RecipientServiceError("Invalid email format", 400);
    }

    if (email !== existing.email) {
      const duplicate = await prisma.reminderRecipient.findUnique({
        where: { email },
      });

      if (duplicate) {
        throw new RecipientServiceError(
          "A reminder recipient with this email already exists",
          409
        );
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

  try {
    const recipient = await prisma.reminderRecipient.update({
      where: { id },
      data,
    });

    return toRecipientResponse(recipient);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return null;
    }
    throw error;
  }
}

export async function deleteRecipient(id: bigint): Promise<boolean> {
  try {
    await prisma.reminderRecipient.delete({ where: { id } });
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

export async function getActiveRecipientEmails(): Promise<string[]> {
  const recipients = await prisma.reminderRecipient.findMany({
    where: { isActive: true },
    orderBy: { email: "asc" },
    select: { email: true },
  });

  return recipients.map((recipient) => recipient.email);
}
