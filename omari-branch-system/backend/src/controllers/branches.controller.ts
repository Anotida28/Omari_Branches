import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  BranchServiceError,
  createBranch,
  deleteBranch,
  getBranchById,
  listBranches,
  updateBranch,
} from "../services/branches.service";

const idSchema = z.string().regex(/^\d+$/, "Invalid id");

const createBranchSchema = z
  .object({
    city: z.string().min(2),
    label: z.string().min(2),
    address: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const updateBranchSchema = z
  .object({
    city: z.string().min(2).optional(),
    label: z.string().min(2).optional(),
    address: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

const listQuerySchema = z.object({
  search: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(10),
});

function normalizeQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

function handleServiceError(res: Response, error: unknown): boolean {
  if (error instanceof BranchServiceError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

export async function listBranchesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const queryInput = {
    search: normalizeQueryValue(req.query.search),
    page: normalizeQueryValue(req.query.page),
    pageSize: normalizeQueryValue(req.query.pageSize),
  };

  const parsedQuery = listQuerySchema.safeParse(queryInput);
  if (!parsedQuery.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedQuery.error.flatten(),
    });
    return;
  }

  try {
    const result = await listBranches(parsedQuery.data);
    res.json(result);
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function getBranchByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedId = idSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const branch = await getBranchById(BigInt(parsedId.data));
    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    res.json({ data: branch });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function createBranchHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedBody = createBranchSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const branch = await createBranch(parsedBody.data);
    res.status(201).json({ data: branch });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function updateBranchHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedId = idSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsedBody = updateBranchSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const branch = await updateBranch(BigInt(parsedId.data), parsedBody.data);
    if (!branch) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    res.json({ data: branch });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function deleteBranchHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedId = idSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const deleted = await deleteBranch(BigInt(parsedId.data));
    if (!deleted) {
      res.status(404).json({ error: "Branch not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}
