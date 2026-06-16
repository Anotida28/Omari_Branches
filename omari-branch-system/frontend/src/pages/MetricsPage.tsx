import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { RefreshCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Pagination } from "../components/ui/Pagination";
import { getErrorMessage } from "../services/api";
import { listBranches } from "../services/branches";
import { formatCurrency, toMoneyNumber } from "../services/format";
import { listMetrics, syncMetrics } from "../services/metrics";
import { DataTable } from "../shared/components/DataTable";
import { EmptyState } from "../shared/components/EmptyState";
import { FilterBar } from "../shared/components/FilterBar";
import { TableSkeletonRows } from "../shared/components/TableSkeletonRows";

const PAGE_SIZE = 10;

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export default function MetricsPage() {
  const queryClient = useQueryClient();
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

  const syncMutation = useMutation({
    mutationFn: syncMetrics,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
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
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          {syncMutation.isSuccess ? (
            <Alert severity="success" variant="outlined" sx={{ py: 0.4 }}>
              Synced {syncMutation.data.importedRowCount} rows across {syncMutation.data.branchCount} branches
              &nbsp;({syncMutation.data.dateFrom} – {syncMutation.data.dateTo})
              {syncMutation.data.missingSourceLineCount > 0 && (
                <> &mdash; <strong>{syncMutation.data.missingSourceLineCount} lines not found in source</ strong></>
              )}
            </Alert>
          ) : syncMutation.isError ? (
            <Alert severity="error" variant="outlined" sx={{ py: 0.4 }}>
              {getErrorMessage(syncMutation.error)}
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Metrics are synced daily from the source system.
            </Typography>
          )}
        </Stack>

        <Stack direction="row" spacing={1} flexShrink={0}>
          <Button
            variant="outlined"
            size="small"
            startIcon={syncMutation.isPending ? <CircularProgress size={14} /> : <RefreshCcw size={14} />}
            disabled={syncMutation.isPending}
            onClick={() => syncMutation.mutate({})}
          >
            {syncMutation.isPending ? "Syncing…" : "Sync Now"}
          </Button>
          <Button
            variant="outlined"
            size="small"
            color="secondary"
            startIcon={syncMutation.isPending ? <CircularProgress size={14} /> : <RefreshCcw size={14} />}
            disabled={syncMutation.isPending}
            onClick={() => {
              const now = new Date();
              const y = now.getFullYear();
              const m = String(now.getMonth() + 1).padStart(2, "0");
              const d = String(now.getDate()).padStart(2, "0");
              syncMutation.mutate({
                dateFrom: `${y}-${m}-01`,
                dateTo: `${y}-${m}-${d}`,
                branchId: branchId || undefined,
              });
            }}
          >
            Sync This Month
          </Button>
        </Stack>
      </Stack>

      {syncMutation.data?.missingSourceLines && syncMutation.data.missingSourceLines.length > 0 ? (
        <Alert severity="warning" variant="outlined">
          <Stack spacing={0.4}>
            <Typography variant="body2" fontWeight={600}>Lines not found in source system:</Typography>
            {syncMutation.data.missingSourceLines.map((line) => (
              <Stack key={line.lineNumber} direction="row" spacing={1}>
                <Chip label={line.lineNumber} size="small" />
                <Typography variant="body2" color="text.secondary">{line.branchName}</Typography>
              </Stack>
            ))}
          </Stack>
        </Alert>
      ) : null}

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
            <TableSkeletonRows columns={14} />
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
