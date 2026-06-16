import { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma";
import {
  fetchSourceAgentBalanceRows,
  fetchSourceAgentMetricRows,
  findSourceAgentsByLineNumbers,
  describeSourceMetricMapping,
  isSourceMetricsConfigured,
} from "./source-agent-metrics.service";
import { recomputeBranchMetricsForWindow } from "./metrics.service";

export class MetricSourceSyncError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "MetricSourceSyncError";
  }
}

export type MetricSourceSyncParams = {
  dateFrom: Date;
  dateTo: Date;
  branchId?: bigint;
};

export type MetricSourceSyncResult = {
  dateFrom: string;
  dateTo: string;
  branchCount: number;
  lineCount: number;
  importedRowCount: number;
  refreshedBranchDateCount: number;
  missingSourceLineCount: number;
  missingSourceLines: Array<{
    lineNumber: string;
    branchId: string;
    branchName: string;
  }>;
  source: ReturnType<typeof describeSourceMetricMapping>;
};

type BranchWithActiveLines = Prisma.BranchGetPayload<{
  include: {
    agentLines: {
      where: { isActive: true };
      orderBy: { lineNumber: "asc" };
    };
  };
}>;

function getPrismaErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return null;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildBranchName(branch: Pick<BranchWithActiveLines, "city" | "label">): string {
  return `${branch.city} - ${branch.label}`;
}

function chunkValues<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

function collectDuplicateAssignments(branches: BranchWithActiveLines[]): Array<{
  lineNumber: string;
  branches: string[];
}> {
  const assignments = new Map<string, Set<string>>();

  for (const branch of branches) {
    const branchName = buildBranchName(branch);
    for (const line of branch.agentLines) {
      const normalizedLine = line.lineNumber.trim();
      if (!normalizedLine) {
        continue;
      }

      if (!assignments.has(normalizedLine)) {
        assignments.set(normalizedLine, new Set());
      }

      assignments.get(normalizedLine)!.add(branchName);
    }
  }

  return Array.from(assignments.entries())
    .filter(([, branchNames]) => branchNames.size > 1)
    .map(([lineNumber, branchNames]) => ({
      lineNumber,
      branches: Array.from(branchNames).sort(),
    }))
    .sort((left, right) => left.lineNumber.localeCompare(right.lineNumber));
}

function createSourceSyncNote(): string {
  return `SOURCE_SYNC:${formatDate(new Date())}`;
}

function createRowKey(lineNumber: string, metricDate: Date): string {
  return `${lineNumber}::${formatDate(metricDate)}`;
}

function enumerateDates(dateFrom: Date, dateTo: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(
    Date.UTC(dateFrom.getUTCFullYear(), dateFrom.getUTCMonth(), dateFrom.getUTCDate()),
  );
  const end = new Date(
    Date.UTC(dateTo.getUTCFullYear(), dateTo.getUTCMonth(), dateTo.getUTCDate()),
  );

  while (cursor.getTime() <= end.getTime()) {
    dates.push(new Date(cursor.getTime()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

async function createMetricRowsInBatches(
  tx: Prisma.TransactionClient,
  rows: Prisma.AgentLineMetricCreateManyInput[],
): Promise<void> {
  for (const batch of chunkValues(rows, 500)) {
    await tx.agentLineMetric.createMany({
      data: batch,
    });
  }
}

export async function syncSourceMetrics(
  params: MetricSourceSyncParams,
): Promise<MetricSourceSyncResult> {
  try {
    if (!isSourceMetricsConfigured()) {
      throw new MetricSourceSyncError(
        "Source SQL metrics sync is not configured.",
        503,
      );
    }

    const branches = await prisma.branch.findMany({
      where: {
        isActive: true,
        ...(params.branchId !== undefined ? { id: params.branchId } : {}),
      },
      include: {
        agentLines: {
          where: { isActive: true },
          orderBy: { lineNumber: "asc" },
        },
      },
      orderBy: [{ city: "asc" }, { label: "asc" }],
    });

    if (params.branchId !== undefined && branches.length === 0) {
      throw new MetricSourceSyncError("Branch not found", 404);
    }

    if (branches.length === 0) {
      return {
        dateFrom: formatDate(params.dateFrom),
        dateTo: formatDate(params.dateTo),
        branchCount: 0,
        lineCount: 0,
        importedRowCount: 0,
        refreshedBranchDateCount: 0,
        missingSourceLineCount: 0,
        missingSourceLines: [],
        source: describeSourceMetricMapping(),
      };
    }

    const duplicateAssignments = collectDuplicateAssignments(branches);
    if (duplicateAssignments.length > 0) {
      const preview = duplicateAssignments
        .slice(0, 5)
        .map((entry) => `${entry.lineNumber} -> ${entry.branches.join(", ")}`)
        .join("; ");
      throw new MetricSourceSyncError(
        `Cannot sync metrics while agent lines are mapped to multiple active branches: ${preview}`,
        409,
      );
    }

    const lineItems = branches.flatMap((branch) =>
      branch.agentLines.map((line) => ({
        branchId: branch.id,
        branchName: buildBranchName(branch),
        lineNumber: line.lineNumber.trim(),
        agentLineId: line.id,
      })),
    );

    const uniqueLineNumbers = Array.from(
      new Set(
        lineItems
          .map((item) => item.lineNumber)
          .filter((lineNumber) => lineNumber.length > 0),
      ),
    );

    if (uniqueLineNumbers.length === 0) {
      return {
        dateFrom: formatDate(params.dateFrom),
        dateTo: formatDate(params.dateTo),
        branchCount: branches.length,
        lineCount: 0,
        importedRowCount: 0,
        refreshedBranchDateCount: 0,
        missingSourceLineCount: 0,
        missingSourceLines: [],
        source: describeSourceMetricMapping(),
      };
    }

    const sourceReferences = await findSourceAgentsByLineNumbers(uniqueLineNumbers);
    const missingSourceLines = lineItems
      .filter((item) => !sourceReferences.has(item.lineNumber))
      .map((item) => ({
        lineNumber: item.lineNumber,
        branchId: item.branchId.toString(),
        branchName: item.branchName,
      }));

    const [sourceRows, balanceRows] = await Promise.all([
      fetchSourceAgentMetricRows({
        lineNumbers: uniqueLineNumbers,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }),
      fetchSourceAgentBalanceRows({
        lineNumbers: uniqueLineNumbers,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
      }),
    ]);

    const agentLineIdByLineNumber = new Map(
      lineItems.map((item) => [item.lineNumber, item.agentLineId] as const),
    );
    const lineNumberByAgentLineId = new Map(
      lineItems.map((item) => [item.agentLineId, item.lineNumber] as const),
    );
    const agentLineIds = Array.from(
      new Set(lineItems.map((item) => item.agentLineId)),
    );
    const createRowsByKey = new Map<string, Prisma.AgentLineMetricCreateManyInput>();

    for (const row of sourceRows) {
      const agentLineId = agentLineIdByLineNumber.get(row.lineNumber);
      if (!agentLineId) {
        continue;
      }

      createRowsByKey.set(createRowKey(row.lineNumber, row.metricDate), {
        agentLineId,
        metricDate: row.metricDate,
        eFloatBalance: 0,
        cashInVolume: row.cashInVolume,
        cashInValue: row.cashInValue,
        cashOutVolume: row.cashOutVolume,
        cashOutValue: row.cashOutValue,
        totalTransactionVolume: row.totalTransactionVolume,
        totalTransactionValue: row.totalTransactionValue,
        commissionOnDeposits: row.commissionOnDeposits,
        commissionOnWithdrawals: row.commissionOnWithdrawals,
        totalCommission: row.totalCommission,
        notes: createSourceSyncNote(),
        createdBy: "SOURCE_SYNC",
      } satisfies Prisma.AgentLineMetricCreateManyInput);
    }

    // Real balance snapshots reported by the source for this window, keyed by line + date.
    const balanceByLineAndDate = new Map<string, number>();
    for (const row of balanceRows) {
      const agentLineId = agentLineIdByLineNumber.get(row.lineNumber);
      if (!agentLineId) {
        continue;
      }
      balanceByLineAndDate.set(createRowKey(row.lineNumber, row.metricDate), row.eFloatBalance);
    }

    // Seed carry-forward with each line's last known balance before this window,
    // so a gap at the very start of the window doesn't fall back to 0.
    const matchedAgentLineIds = agentLineIds.filter((agentLineId) => {
      const lineNumber = lineNumberByAgentLineId.get(agentLineId);
      return lineNumber !== undefined && sourceReferences.has(lineNumber);
    });

    const priorBalanceRows = matchedAgentLineIds.length > 0
      ? await prisma.agentLineMetric.findMany({
          where: {
            agentLineId: { in: matchedAgentLineIds },
            metricDate: { lt: params.dateFrom },
          },
          orderBy: { metricDate: "desc" },
          select: { agentLineId: true, eFloatBalance: true },
        })
      : [];

    const carryBalanceByAgentLineId = new Map<bigint, number>();
    for (const row of priorBalanceRows) {
      if (!carryBalanceByAgentLineId.has(row.agentLineId)) {
        carryBalanceByAgentLineId.set(row.agentLineId, Number(row.eFloatBalance));
      }
    }

    const metricDates = enumerateDates(params.dateFrom, params.dateTo);

    // Only carry-forward balances for lines the source actually knows about.
    // Lines with no source match at all stay untouched (no synthetic data).
    for (const agentLineId of matchedAgentLineIds) {
      const lineNumber = lineNumberByAgentLineId.get(agentLineId)!;
      let carry = carryBalanceByAgentLineId.get(agentLineId) ?? 0;

      for (const metricDate of metricDates) {
        const key = createRowKey(lineNumber, metricDate);
        const realBalance = balanceByLineAndDate.get(key);
        const resolvedBalance = realBalance !== undefined ? realBalance : carry;
        carry = resolvedBalance;

        const existing = createRowsByKey.get(key);
        if (existing) {
          existing.eFloatBalance = resolvedBalance;
          continue;
        }

        createRowsByKey.set(key, {
          agentLineId,
          metricDate,
          eFloatBalance: resolvedBalance,
          cashInVolume: 0,
          cashInValue: 0,
          cashOutVolume: 0,
          cashOutValue: 0,
          totalTransactionVolume: 0,
          totalTransactionValue: 0,
          commissionOnDeposits: 0,
          commissionOnWithdrawals: 0,
          totalCommission: 0,
          notes: realBalance !== undefined ? createSourceSyncNote() : `${createSourceSyncNote()}:CARRIED`,
          createdBy: "SOURCE_SYNC",
        } satisfies Prisma.AgentLineMetricCreateManyInput);
      }
    }

    const createRows = Array.from(createRowsByKey.values());

    await prisma.$transaction(async (tx) => {
      await tx.agentLineMetric.deleteMany({
        where: {
          agentLineId: { in: agentLineIds },
          metricDate: {
            gte: params.dateFrom,
            lte: params.dateTo,
          },
        },
      });

      if (createRows.length > 0) {
        await createMetricRowsInBatches(tx, createRows);
      }
    }, { timeout: 120_000 });

    const refreshedBranchDateCount = await recomputeBranchMetricsForWindow(
      branches.map((branch) => branch.id),
      params.dateFrom,
      params.dateTo,
    );

    return {
      dateFrom: formatDate(params.dateFrom),
      dateTo: formatDate(params.dateTo),
      branchCount: branches.length,
      lineCount: uniqueLineNumbers.length,
      importedRowCount: createRows.length,
      refreshedBranchDateCount,
      missingSourceLineCount: missingSourceLines.length,
      missingSourceLines,
      source: describeSourceMetricMapping(),
    };
  } catch (error) {
    if (error instanceof MetricSourceSyncError) {
      throw error;
    }

    if (getPrismaErrorCode(error) === "P2021") {
      throw new MetricSourceSyncError(
        "The app database schema is missing the branch metrics tables. Apply the backend schema before running source sync.",
        503,
      );
    }

    throw error;
  }
}
