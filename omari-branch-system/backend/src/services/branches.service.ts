import { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma";

export class BranchServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "BranchServiceError";
  }
}

export type BranchCreateInput = {
  city: string;
  label: string;
  address?: string;
  isActive?: boolean;
  agentLineNumbers?: string[];
};

export type BranchUpdateInput = {
  city?: string;
  label?: string;
  address?: string;
  isActive?: boolean;
  agentLineNumbers?: string[];
};

type BranchWithAgentLines = Prisma.BranchGetPayload<{
  include: {
    agentLines: true;
  };
}>;

export type BranchResponse = {
  id: string;
  city: string;
  label: string;
  address: string | null;
  isActive: boolean;
  agentLines: Array<{
    id: string;
    lineNumber: string;
    isActive: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
  displayName: string;
};

export type BranchListParams = {
  search?: string;
  page: number;
  pageSize: number;
};

export type BranchListResult = {
  items: BranchResponse[];
  page: number;
  pageSize: number;
  total: number;
};

function normalizeAgentLineNumbers(
  agentLineNumbers: string[] | undefined,
): string[] {
  if (!agentLineNumbers) {
    return [];
  }

  const normalized = agentLineNumbers
    .map((lineNumber) => lineNumber.trim())
    .filter((lineNumber) => lineNumber.length > 0);

  return Array.from(new Set(normalized));
}

function toBranchResponse(branch: BranchWithAgentLines): BranchResponse {
  return {
    id: branch.id.toString(),
    city: branch.city,
    label: branch.label,
    address: branch.address,
    isActive: branch.isActive,
    agentLines: branch.agentLines
      .map((line) => ({
        id: line.id.toString(),
        lineNumber: line.lineNumber,
        isActive: line.isActive,
      }))
      .sort((a, b) => a.lineNumber.localeCompare(b.lineNumber)),
    createdAt: branch.createdAt,
    updatedAt: branch.updatedAt,
    displayName: `${branch.city} - ${branch.label}`,
  };
}

function mapUniqueConstraintError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new BranchServiceError(
        "Branch with the same city and label already exists",
        409,
      );
    }
  }
  throw error;
}

export async function listBranches(
  params: BranchListParams,
): Promise<BranchListResult> {
  const { search, page, pageSize } = params;
  const q = search?.trim();
  const where = q
    ? {
        OR: [{ city: { contains: q } }, { label: { contains: q } }],
      }
    : {};
  const skip = (page - 1) * pageSize;

  const [total, items] = await Promise.all([
    prisma.branch.count({ where }),
    prisma.branch.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        agentLines: {
          where: { isActive: true },
          orderBy: { lineNumber: "asc" },
        },
      },
      orderBy: [{ city: "asc" }, { label: "asc" }],
    }),
  ]);

  return {
    items: items.map(toBranchResponse),
    page,
    pageSize,
    total,
  };
}

export async function getBranchById(
  id: bigint,
): Promise<BranchResponse | null> {
  const branch = await prisma.branch.findUnique({
    where: { id },
    include: {
      agentLines: {
        where: { isActive: true },
        orderBy: { lineNumber: "asc" },
      },
    },
  });

  return branch ? toBranchResponse(branch) : null;
}

export async function createBranch(
  input: BranchCreateInput,
): Promise<BranchResponse> {
  const normalizedAgentLines = normalizeAgentLineNumbers(input.agentLineNumbers);

  const data: Prisma.BranchCreateInput = {
    city: input.city,
    label: input.label,
    agentLines:
      normalizedAgentLines.length > 0
        ? {
            create: normalizedAgentLines.map((lineNumber) => ({ lineNumber })),
          }
        : undefined,
  };

  if (input.address !== undefined) {
    data.address = input.address;
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  try {
    const branch = await prisma.branch.create({
      data,
      include: {
        agentLines: {
          where: { isActive: true },
          orderBy: { lineNumber: "asc" },
        },
      },
    });
    return toBranchResponse(branch);
  } catch (error) {
    mapUniqueConstraintError(error);
  }
}

export async function updateBranch(
  id: bigint,
  input: BranchUpdateInput,
): Promise<BranchResponse | null> {
  const normalizedAgentLines =
    input.agentLineNumbers !== undefined
      ? normalizeAgentLineNumbers(input.agentLineNumbers)
      : undefined;

  const data: Prisma.BranchUpdateInput = {};

  if (input.city !== undefined) {
    data.city = input.city;
  }

  if (input.label !== undefined) {
    data.label = input.label;
  }

  if (input.address !== undefined) {
    data.address = input.address;
  }

  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }

  if (normalizedAgentLines !== undefined) {
    data.agentLines = {
      deleteMany: {},
      create: normalizedAgentLines.map((lineNumber) => ({ lineNumber })),
    };
  }

  try {
    const branch = await prisma.branch.update({
      where: { id },
      data,
      include: {
        agentLines: {
          where: { isActive: true },
          orderBy: { lineNumber: "asc" },
        },
      },
    });
    return toBranchResponse(branch);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return null;
      }
      if (error.code === "P2002") {
        throw new BranchServiceError(
          "Branch with the same city and label already exists",
          409,
        );
      }
    }
    throw error;
  }
}

export async function deleteBranch(id: bigint): Promise<boolean> {
  try {
    await prisma.branch.delete({ where: { id } });
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
