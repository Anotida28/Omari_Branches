import { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma";
import {
  findSourceAgentsByLineNumbers,
  isSourceMetricsConfigured,
  type SourceAgentReference,
} from "./source-agent-metrics.service";

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
    agentLines: {
      select: {
        id: true;
        lineNumber: true;
        isActive: true;
      };
    };
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

export type BranchAgentLineValidationStatus =
  | "available"
  | "already_assigned"
  | "not_found"
  | "unverified";

export type BranchAgentLineValidationResult = {
  lineNumber: string;
  isAvailable: boolean;
  status: BranchAgentLineValidationStatus;
  message: string;
  conflictingBranchName: string | null;
  sourceAgent: SourceAgentReference | null;
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

function buildAgentLineMutation(
  existingLines: Array<{
    id: bigint;
    lineNumber: string;
    isActive: boolean;
  }>,
  nextLineNumbers: string[],
): Prisma.BranchUpdateInput["agentLines"] {
  const existingByLineNumber = new Map(
    existingLines.map((line) => [line.lineNumber.trim(), line] as const),
  );
  const nextLineSet = new Set(nextLineNumbers);

  const linesToDeactivate = existingLines
    .filter((line) => line.isActive && !nextLineSet.has(line.lineNumber.trim()))
    .map((line) => line.id);

  const linesToReactivate = nextLineNumbers
    .map((lineNumber) => existingByLineNumber.get(lineNumber))
    .filter(
      (
        line,
      ): line is {
        id: bigint;
        lineNumber: string;
        isActive: boolean;
      } => Boolean(line && !line.isActive),
    )
    .map((line) => line.id);

  const linesToCreate = nextLineNumbers.filter(
    (lineNumber) => !existingByLineNumber.has(lineNumber),
  );

  const updateManyOperations: Prisma.BranchAgentLineUpdateManyWithWhereWithoutBranchInput[] =
    [];
  const operations: Prisma.BranchUpdateInput["agentLines"] = {};

  if (linesToDeactivate.length > 0) {
    updateManyOperations.push({
      where: {
        id: {
          in: linesToDeactivate,
        },
      },
      data: {
        isActive: false,
      },
    });
  }

  if (linesToReactivate.length > 0) {
    updateManyOperations.push({
      where: {
        id: {
          in: linesToReactivate,
        },
      },
      data: {
        isActive: true,
      },
    });
  }

  if (updateManyOperations.length > 0) {
    operations.updateMany = updateManyOperations;
  }

  if (linesToCreate.length > 0) {
    operations.create = linesToCreate.map((lineNumber) => ({ lineNumber }));
  }

  return operations;
}

async function findActiveLineConflicts(
  agentLineNumbers: string[],
  currentBranchId?: bigint,
): Promise<Array<{ lineNumber: string; branchName: string }>> {
  if (agentLineNumbers.length === 0) {
    return [];
  }

  const conflictingLines = await prisma.branchAgentLine.findMany({
    where: {
      lineNumber: {
        in: agentLineNumbers,
      },
      isActive: true,
      ...(currentBranchId !== undefined
        ? {
            branchId: {
              not: currentBranchId,
            },
          }
        : {}),
      branch: {
        isActive: true,
      },
    },
    include: {
      branch: {
        select: {
          city: true,
          label: true,
        },
      },
    },
    orderBy: [{ lineNumber: "asc" }],
  });

  return conflictingLines.map((line) => ({
    lineNumber: line.lineNumber,
    branchName: `${line.branch.city} - ${line.branch.label}`,
  }));
}

async function assertAgentLinesAreSafe(
  agentLineNumbers: string[],
  currentBranchId?: bigint,
): Promise<void> {
  if (agentLineNumbers.length === 0) {
    return;
  }

  const conflicts = await findActiveLineConflicts(agentLineNumbers, currentBranchId);
  if (conflicts.length > 0) {
    const preview = conflicts
      .slice(0, 5)
      .map((conflict) => `${conflict.lineNumber} (${conflict.branchName})`)
      .join(", ");
    throw new BranchServiceError(
      `Agent line numbers must belong to only one active branch. Conflicts: ${preview}`,
      409,
    );
  }

  if (!isSourceMetricsConfigured()) {
    return;
  }

  const sourceAgents = await findSourceAgentsByLineNumbers(agentLineNumbers);
  const missingLineNumbers = agentLineNumbers.filter(
    (lineNumber) => !sourceAgents.has(lineNumber),
  );

  if (missingLineNumbers.length > 0) {
    throw new BranchServiceError(
      `These agent line numbers were not found in the source metrics database: ${missingLineNumbers
        .slice(0, 10)
        .join(", ")}`,
      400,
    );
  }
}

export async function validateBranchAgentLine(
  lineNumberInput: string,
  currentBranchId?: bigint,
): Promise<BranchAgentLineValidationResult> {
  const lineNumber = lineNumberInput.trim();

  if (!lineNumber) {
    throw new BranchServiceError("Agent line number is required.", 400);
  }

  const sourceConfigured = isSourceMetricsConfigured();
  const [conflicts, sourceAgents] = await Promise.all([
    findActiveLineConflicts([lineNumber], currentBranchId),
    sourceConfigured
      ? findSourceAgentsByLineNumbers([lineNumber])
      : Promise.resolve(new Map<string, SourceAgentReference>()),
  ]);

  const sourceAgent = sourceAgents.get(lineNumber) ?? null;

  if (conflicts.length > 0) {
    return {
      lineNumber,
      isAvailable: false,
      status: "already_assigned",
      message: `This line is already assigned to ${conflicts[0].branchName}.`,
      conflictingBranchName: conflicts[0].branchName,
      sourceAgent,
    };
  }

  if (!sourceConfigured) {
    return {
      lineNumber,
      isAvailable: true,
      status: "unverified",
      message:
        "Source metrics database is not configured, so this line could not be verified there.",
      conflictingBranchName: null,
      sourceAgent: null,
    };
  }

  if (!sourceAgent) {
    return {
      lineNumber,
      isAvailable: false,
      status: "not_found",
      message: "This line was not found in the source metrics database.",
      conflictingBranchName: null,
      sourceAgent: null,
    };
  }

  return {
    lineNumber,
    isAvailable: true,
    status: "available",
    message: "This line is available and ready to add.",
    conflictingBranchName: null,
    sourceAgent,
  };
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
          select: {
            id: true,
            lineNumber: true,
            isActive: true,
          },
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
        select: {
          id: true,
          lineNumber: true,
          isActive: true,
        },
      },
    },
  });

  return branch ? toBranchResponse(branch) : null;
}

export async function createBranch(
  input: BranchCreateInput,
): Promise<BranchResponse> {
  const normalizedAgentLines = normalizeAgentLineNumbers(input.agentLineNumbers);

  await assertAgentLinesAreSafe(normalizedAgentLines);

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
          select: {
            id: true,
            lineNumber: true,
            isActive: true,
          },
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
  const existingBranch = await prisma.branch.findUnique({
    where: { id },
    include: {
      agentLines: {
        orderBy: { lineNumber: "asc" },
        select: {
          id: true,
          lineNumber: true,
          isActive: true,
        },
      },
    },
  });

  if (!existingBranch) {
    return null;
  }

  const normalizedAgentLines =
    input.agentLineNumbers !== undefined
      ? normalizeAgentLineNumbers(input.agentLineNumbers)
      : undefined;
  const nextAgentLines =
    normalizedAgentLines ??
    existingBranch.agentLines
      .filter((line) => line.isActive)
      .map((line) => line.lineNumber.trim());
  await assertAgentLinesAreSafe(nextAgentLines, id);

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
    data.agentLines = buildAgentLineMutation(
      existingBranch.agentLines,
      normalizedAgentLines,
    );
  }

  try {
    const branch = await prisma.branch.update({
      where: { id },
      data,
      include: {
        agentLines: {
          where: { isActive: true },
          orderBy: { lineNumber: "asc" },
          select: {
            id: true,
            lineNumber: true,
            isActive: true,
          },
        },
      },
    });
    return toBranchResponse(branch);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new BranchServiceError(
        "Branch with the same city and label already exists",
        409,
      );
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
