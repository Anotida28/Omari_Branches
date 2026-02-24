import { Prisma, type BranchRecipient } from "@prisma/client";

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
  branchId: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
};

function formatDateTime(date: Date): string {
  return date.toISOString();
}

function toRecipientResponse(recipient: BranchRecipient): RecipientResponse {
  return {
    id: recipient.id.toString(),
    branchId: recipient.branchId.toString(),
    email: recipient.email,
    name: recipient.name ?? null,
    isActive: recipient.isActive,
    createdAt: formatDateTime(recipient.createdAt),
  };
}

/**
 * Email validation regex (basic but sufficient for most cases)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * List all recipients for a branch
 */
export async function listRecipientsForBranch(
  branchId: bigint
): Promise<RecipientResponse[] | null> {
  // Check if branch exists
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true },
  });

  if (!branch) {
    return null;
  }

  const recipients = await prisma.branchRecipient.findMany({
    where: { branchId },
    orderBy: [{ isActive: "desc" }, { email: "asc" }],
  });

  return recipients.map(toRecipientResponse);
}

/**
 * Get a single recipient by ID
 */
export async function getRecipientById(
  id: bigint
): Promise<RecipientResponse | null> {
  const recipient = await prisma.branchRecipient.findUnique({
    where: { id },
  });

  return recipient ? toRecipientResponse(recipient) : null;
}

/**
 * Create a recipient for a branch
 */
export async function createRecipient(
  branchId: bigint,
  input: RecipientCreateInput
): Promise<RecipientResponse> {
  const email = input.email.trim().toLowerCase();

  // Validate email format
  if (!validateEmail(email)) {
    throw new RecipientServiceError("Invalid email format", 400);
  }

  // Check if branch exists
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true },
  });

  if (!branch) {
    throw new RecipientServiceError("Branch not found", 404);
  }

  // Check for duplicate email in this branch
  const existing = await prisma.branchRecipient.findUnique({
    where: {
      uq_branch_email: {
        branchId,
        email,
      },
    },
  });

  if (existing) {
    throw new RecipientServiceError(
      "A recipient with this email already exists for this branch",
      409
    );
  }

  const data: Prisma.BranchRecipientCreateInput = {
    branch: { connect: { id: branchId } },
    email,
    name: input.name?.trim() || null,
    isActive: input.isActive ?? true,
  };

  const recipient = await prisma.branchRecipient.create({ data });

  return toRecipientResponse(recipient);
}

/**
 * Update a recipient
 */
export async function updateRecipient(
  id: bigint,
  input: RecipientUpdateInput
): Promise<RecipientResponse | null> {
  // Get existing recipient
  const existing = await prisma.branchRecipient.findUnique({
    where: { id },
  });

  if (!existing) {
    return null;
  }

  const data: Prisma.BranchRecipientUpdateInput = {};

  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();

    if (!validateEmail(email)) {
      throw new RecipientServiceError("Invalid email format", 400);
    }

    // Check for duplicate email if changing
    if (email !== existing.email) {
      const duplicate = await prisma.branchRecipient.findUnique({
        where: {
          uq_branch_email: {
            branchId: existing.branchId,
            email,
          },
        },
      });

      if (duplicate) {
        throw new RecipientServiceError(
          "A recipient with this email already exists for this branch",
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
    const recipient = await prisma.branchRecipient.update({
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

/**
 * Delete a recipient
 */
export async function deleteRecipient(id: bigint): Promise<boolean> {
  try {
    await prisma.branchRecipient.delete({ where: { id } });
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

/**
 * Get active recipients for a branch (for sending alerts)
 */
export async function getActiveRecipientsForBranch(
  branchId: bigint
): Promise<RecipientResponse[]> {
  const recipients = await prisma.branchRecipient.findMany({
    where: {
      branchId,
      isActive: true,
    },
    orderBy: { email: "asc" },
  });

  return recipients.map(toRecipientResponse);
}
