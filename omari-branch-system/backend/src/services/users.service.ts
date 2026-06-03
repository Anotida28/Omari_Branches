import { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma";
import { UserRole } from "../shared/prisma-enums";

export class UserServiceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "UserServiceError";
  }
}

export type UserResponse = {
  id: string;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function toUserResponse(user: {
  id: bigint;
  username: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): UserResponse {
  return {
    id: user.id.toString(),
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function listUsers(): Promise<UserResponse[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { username: "asc" }],
  });
  return users.map(toUserResponse);
}

export async function createUser(input: {
  username: string;
  role: string;
}): Promise<UserResponse> {
  const username = input.username.trim().toLowerCase();
  if (!username) {
    throw new UserServiceError("Username is required", 400);
  }

  const validRoles = [UserRole.VIEWER, UserRole.FULL_ACCESS, UserRole.SUPER_ADMIN];
  if (!validRoles.includes(input.role as never)) {
    throw new UserServiceError(`Role must be one of: ${validRoles.join(", ")}`, 400);
  }

  try {
    const user = await prisma.user.create({
      data: { username, role: input.role, isActive: true },
    });
    return toUserResponse(user);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new UserServiceError(`Username "${username}" is already registered`, 409);
    }
    throw error;
  }
}

export async function updateUser(
  id: bigint,
  requesterId: bigint,
  input: { role?: string; isActive?: boolean },
): Promise<UserResponse> {
  if (id === requesterId) {
    throw new UserServiceError("You cannot change your own role or status", 400);
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new UserServiceError("User not found", 404);
  }

  const data: Prisma.UserUpdateInput = {};

  if (input.role !== undefined) {
    const validRoles = [UserRole.VIEWER, UserRole.FULL_ACCESS, UserRole.SUPER_ADMIN];
    if (!validRoles.includes(input.role as never)) {
      throw new UserServiceError(`Role must be one of: ${validRoles.join(", ")}`, 400);
    }
    data.role = input.role;
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  const updated = await prisma.user.update({ where: { id }, data });
  return toUserResponse(updated);
}
