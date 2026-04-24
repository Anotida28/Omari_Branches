import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  MenuItem,
  TableCell,
  TableRow,
  TextField,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { Pagination } from "../components/ui/Pagination";
import { getErrorMessage } from "../services/api";
import { listBranches } from "../services/branches";
import { formatCurrency, toMoneyNumber } from "../services/format";
import { listMetrics } from "../services/metrics";
import { DataTable } from "../shared/components/DataTable";
import { EmptyState } from "../shared/components/EmptyState";
import { FilterBar } from "../shared/components/FilterBar";

const PAGE_SIZE = 10;

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export default function MetricsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parsePage(searchParams.get("page"));
  const branchId = searchParams.get("branchId") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  const updateParams = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
        return;
      }
      next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  const branchesQuery = useQuery({
    queryKey: ["branches", "all", "for-metrics"],
    queryFn: () => listBranches({ page: 1, pageSize: 100 }),
  });

  const metricsQuery = useQuery({
    queryKey: ["metrics", { page, branchId, dateFrom, dateTo }],
    queryFn: () =>
      listMetrics({
        page,
        pageSize: PAGE_SIZE,
        branchId: branchId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const branchMap = useMemo(
    () =>
      new Map(
        (branchesQuery.data?.items ?? []).map((branch) => [branch.id, branch.displayName]),
      ),
    [branchesQuery.data?.items],
  );

  const errorMessage = (() => {
    if (branchesQuery.isError) {
      return getErrorMessage(branchesQuery.error);
    }
    if (metricsQuery.isError) {
      return getErrorMessage(metricsQuery.error);
    }
    return "";
  })();

  return (
    <section className="space-y-5 motion-fade-up">
      <Alert severity="info" variant="outlined">
        Branch metrics are synced from the source system. Manual create and delete actions are no
        longer available in the UI.
      </Alert>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <FilterBar>
        <div className="flex flex-col gap-3 md:flex-row">
          <TextField
            select
            label="Branch"
            value={branchId}
            onChange={(event) =>
              updateParams({
                branchId: event.target.value || undefined,
                page: "1",
              })
            }
            sx={{ minWidth: { xs: "100%", md: 220 } }}
          >
            <MenuItem value="">All branches</MenuItem>
            {(branchesQuery.data?.items ?? []).map((branch) => (
              <MenuItem key={branch.id} value={branch.id}>
                {branch.displayName}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            type="date"
            label="Date From"
            value={dateFrom}
            onChange={(event) =>
              updateParams({
                dateFrom: event.target.value || undefined,
                page: "1",
              })
            }
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", md: 170 } }}
          />

          <TextField
            type="date"
            label="Date To"
            value={dateTo}
            onChange={(event) =>
              updateParams({
                dateTo: event.target.value || undefined,
                page: "1",
              })
            }
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", md: 170 } }}
          />

          <Button
            variant="outlined"
            onClick={() => setSearchParams({}, { replace: true })}
            sx={{ width: { xs: "100%", md: "auto" }, whiteSpace: "nowrap" }}
          >
            Reset Filters
          </Button>
        </div>
      </FilterBar>

      <DataTable
        head={
          <TableRow>
            <TableCell>Branch</TableCell>
            <TableCell>Date</TableCell>
            <TableCell align="right">E-Float</TableCell>
            <TableCell align="right">Cash In Count</TableCell>
            <TableCell align="right">Cash In Value</TableCell>
            <TableCell align="right">Cash Out Count</TableCell>
            <TableCell align="right">Cash Out Value</TableCell>
            <TableCell align="right">Txn Count</TableCell>
            <TableCell align="right">Txn Value</TableCell>
            <TableCell align="right">Deposit Comm.</TableCell>
            <TableCell align="right">Withdrawal Comm.</TableCell>
            <TableCell align="right">Total Comm.</TableCell>
            <TableCell align="right">Net Movement</TableCell>
            <TableCell align="right">Source Lines</TableCell>
          </TableRow>
        }
        body={
          metricsQuery.isLoading ? (
            <TableRow>
              <TableCell colSpan={14} align="center" sx={{ py: 4, color: "text.secondary" }}>
                Loading metrics...
              </TableCell>
            </TableRow>
          ) : (metricsQuery.data?.items.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={14} sx={{ py: 5 }}>
                <EmptyState
                  title="No metrics found"
                  description="Metrics will appear here once source sync has imported branch data."
                />
              </TableCell>
            </TableRow>
          ) : (
            metricsQuery.data?.items.map((metric) => (
              <TableRow key={metric.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>
                  {branchMap.get(metric.branchId) ?? metric.branchId}
                </TableCell>
                <TableCell>{metric.date}</TableCell>
                <TableCell align="right">{formatCurrency(toMoneyNumber(metric.eFloatBalance))}</TableCell>
                <TableCell align="right">{metric.cashInVolume}</TableCell>
                <TableCell align="right">{formatCurrency(toMoneyNumber(metric.cashInValue))}</TableCell>
                <TableCell align="right">{metric.cashOutVolume}</TableCell>
                <TableCell align="right">{formatCurrency(toMoneyNumber(metric.cashOutValue))}</TableCell>
                <TableCell align="right">{metric.totalTransactionVolume}</TableCell>
                <TableCell align="right">
                  {formatCurrency(toMoneyNumber(metric.totalTransactionValue))}
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(toMoneyNumber(metric.commissionOnDeposits))}
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(toMoneyNumber(metric.commissionOnWithdrawals))}
                </TableCell>
                <TableCell align="right">
                  {formatCurrency(toMoneyNumber(metric.totalCommission))}
                </TableCell>
                <TableCell align="right">{formatCurrency(toMoneyNumber(metric.netCashValue))}</TableCell>
                <TableCell align="right">{metric.sourceLineCount}</TableCell>
              </TableRow>
            ))
          )
        }
      />

      <Pagination
        page={metricsQuery.data?.page ?? page}
        pageSize={metricsQuery.data?.pageSize ?? PAGE_SIZE}
        total={metricsQuery.data?.total ?? 0}
        onPageChange={(nextPage) => updateParams({ page: String(nextPage) })}
      />
    </section>
  );
}
