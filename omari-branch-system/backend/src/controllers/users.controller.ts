import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  createUser,
  listUsers,
  updateUser,
  UserServiceError,
} from "../services/users.service";

const createUserSchema = z.object({
  username: z.string().min(1).max(80),
  role: z.enum(["VIEWER", "FULL_ACCESS", "SUPER_ADMIN"]),
});

const updateUserSchema = z
  .object({
    role: z.enum(["VIEWER", "FULL_ACCESS", "SUPER_ADMIN"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.role !== undefined || d.isActive !== undefined, {
    message: "At least one of role or isActive must be provided",
  });

function handleError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof UserServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  next(error);
}

export async function listUsersHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const users = await listUsers();
    res.json({ items: users });
  } catch (error) {
    next(error);
  }
}

export async function createUserHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", details: parsed.error.flatten() });
    return;
  }

  try {
    const user = await createUser(parsed.data);
    res.status(201).json({ data: user });
  } catch (error) {
    handleError(error, res, next);
  }
}

export async function updateUserHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const id = BigInt(req.params.id ?? "0");
  if (!id) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", details: parsed.error.flatten() });
    return;
  }

  try {
    const requesterId = req.authUser!.id;
    const user = await updateUser(id, requesterId, parsed.data);
    res.json({ data: user });
  } catch (error) {
    handleError(error, res, next);
  }
}
