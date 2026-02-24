import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { Modal } from "../components/ui/Modal";
import { Pagination } from "../components/ui/Pagination";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";
import { listBranches } from "../services/branches";
import { formatCurrency, toMoneyNumber } from "../services/format";
import { deleteMetric, listMetrics, upsertMetric } from "../services/metrics";
import { DataTable } from "../shared/components/DataTable";
import { EmptyState } from "../shared/components/EmptyState";
import { FilterBar } from "../shared/components/FilterBar";
import type { UpsertMetricInput } from "../types/api";

const PAGE_SIZE = 10;

const DEFAULT_UPSERT: UpsertMetricInput = {
  branchId: "",
  date: new Date().toISOString().slice(0, 10),
  cashBalance: 0,
  eFloatBalance: 0,
  cashInVault: 0,
  cashInVolume: 0,
  cashInValue: 0,
  cashOutVolume: 0,
  cashOutValue: 0,
};

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export default function MetricsPage() {
  const queryClient = useQueryClient();
  const { canWrite } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isUpsertOpen, setIsUpsertOpen] = useState(false);
  const [upsertForm, setUpsertForm] = useState<UpsertMetricInput>(DEFAULT_UPSERT);
  const [formError, setFormError] = useState("");

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

  const upsertMutation = useMutation({
    mutationFn: upsertMetric,
    onSuccess: () => {
      setFormError("");
      setIsUpsertOpen(false);
      setUpsertForm(DEFAULT_UPSERT);
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMetric,
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

  const submitUpsert = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canWrite) {
      return;
    }

    if (!upsertForm.branchId) {
      setFormError("Branch is required.");
      return;
    }

    setFormError("");
    upsertMutation.mutate({
      ...upsertForm,
      cashBalance: Number(upsertForm.cashBalance),
      eFloatBalance: Number(upsertForm.eFloatBalance),
      cashInVault: Number(upsertForm.cashInVault),
      cashInVolume: Math.trunc(Number(upsertForm.cashInVolume)),
      cashInValue: Number(upsertForm.cashInValue),
      cashOutVolume: Math.trunc(Number(upsertForm.cashOutVolume)),
      cashOutValue: Number(upsertForm.cashOutValue),
    });
  };

  const errorMessage = (() => {
    if (branchesQuery.isError) {
      return getErrorMessage(branchesQuery.error);
    }
    if (metricsQuery.isError) {
      return getErrorMessage(metricsQuery.error);
    }
    if (upsertMutation.isError) {
      return getErrorMessage(upsertMutation.error);
    }
    if (deleteMutation.isError) {
      return getErrorMessage(deleteMutation.error);
    }
    return "";
  })();

  return (
    <section className="space-y-5 motion-fade-up">
      {canWrite ? (
        <Stack direction="row" justifyContent="flex-end">
          <Button
            variant="contained"
            startIcon={<Plus size={15} />}
            onClick={() => setIsUpsertOpen(true)}
          >
            Upsert Metric
          </Button>
        </Stack>
      ) : null}

      {!canWrite ? (
        <Alert severity="info" variant="outlined">
          VIEWER mode enabled. Metric create, update, and delete actions are disabled.
        </Alert>
      ) : null}

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <FilterBar>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
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
        </Stack>
      </FilterBar>

      <DataTable
        head={
          <TableRow>
            <TableCell>Branch</TableCell>
            <TableCell>Date</TableCell>
            <TableCell align="right">Cash Balance</TableCell>
            <TableCell align="right">E-Float</TableCell>
            <TableCell align="right">Cash in Vault</TableCell>
            <TableCell align="right">Cash on Branch</TableCell>
            <TableCell align="right">Cash In / Out</TableCell>
            <TableCell align="right">Net Cash</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        }
        body={
          metricsQuery.isLoading ? (
            <TableRow>
              <TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
                Loading metrics...
              </TableCell>
            </TableRow>
          ) : (metricsQuery.data?.items.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={9} sx={{ py: 5 }}>
                <EmptyState
                  title="No metrics found"
                  description="Adjust filters or create the first metric entry."
                />
              </TableCell>
            </TableRow>
          ) : (
            <>
              {metricsQuery.data?.items.map((metric) => (
                <TableRow key={metric.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {branchMap.get(metric.branchId) ?? metric.branchId}
                  </TableCell>
                  <TableCell>{metric.date}</TableCell>
                  <TableCell align="right">{formatCurrency(toMoneyNumber(metric.cashBalance))}</TableCell>
                  <TableCell align="right">{formatCurrency(toMoneyNumber(metric.eFloatBalance))}</TableCell>
                  <TableCell align="right">{formatCurrency(toMoneyNumber(metric.cashInVault))}</TableCell>
                  <TableCell align="right">{formatCurrency(toMoneyNumber(metric.cashOnBranch))}</TableCell>
                  <TableCell align="right">
                    {metric.cashInVolume}/{metric.cashOutVolume}
                  </TableCell>
                  <TableCell align="right">{formatCurrency(toMoneyNumber(metric.netCashValue))}</TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<Trash2 size={14} />}
                      disabled={!canWrite || deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(metric.id)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </>
          )
        }
      />

      <Pagination
        page={metricsQuery.data?.page ?? page}
        pageSize={metricsQuery.data?.pageSize ?? PAGE_SIZE}
        total={metricsQuery.data?.total ?? 0}
        onPageChange={(nextPage) => updateParams({ page: String(nextPage) })}
      />

      <Modal
        open={isUpsertOpen}
        title="Upsert Metric"
        onClose={() => {
          setIsUpsertOpen(false);
          setFormError("");
        }}
        footer={
          <>
            <Button
              variant="text"
              color="secondary"
              onClick={() => {
                setIsUpsertOpen(false);
                setFormError("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="upsert-metric-form"
              variant="contained"
              disabled={!canWrite || upsertMutation.isPending}
            >
              {upsertMutation.isPending ? "Saving..." : "Save Metric"}
            </Button>
          </>
        }
      >
        <Box component="form" id="upsert-metric-form" onSubmit={submitUpsert} sx={{ display: "grid", gap: 1.4 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
            <TextField
              select
              label="Branch"
              value={upsertForm.branchId}
              onChange={(event) =>
                setUpsertForm((prev) => ({ ...prev, branchId: event.target.value }))
              }
              fullWidth
            >
              <MenuItem value="">Select branch</MenuItem>
              {(branchesQuery.data?.items ?? []).map((branch) => (
                <MenuItem key={branch.id} value={branch.id}>
                  {branch.displayName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              type="date"
              label="Date"
              value={upsertForm.date}
              onChange={(event) =>
                setUpsertForm((prev) => ({ ...prev, date: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
            <TextField
              label="Cash Balance"
              type="number"
              value={upsertForm.cashBalance}
              onChange={(event) =>
                setUpsertForm((prev) => ({ ...prev, cashBalance: Number(event.target.value) }))
              }
              inputProps={{ min: 0, step: "0.01" }}
              fullWidth
            />
            <TextField
              label="E-Float Balance"
              type="number"
              value={upsertForm.eFloatBalance}
              onChange={(event) =>
                setUpsertForm((prev) => ({ ...prev, eFloatBalance: Number(event.target.value) }))
              }
              inputProps={{ min: 0, step: "0.01" }}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
            <TextField
              label="Cash in Vault"
              type="number"
              value={upsertForm.cashInVault}
              onChange={(event) =>
                setUpsertForm((prev) => ({ ...prev, cashInVault: Number(event.target.value) }))
              }
              inputProps={{ min: 0, step: "0.01" }}
              fullWidth
            />
            <TextField
              label="Cash In Volume"
              type="number"
              value={upsertForm.cashInVolume}
              onChange={(event) =>
                setUpsertForm((prev) => ({ ...prev, cashInVolume: Number(event.target.value) }))
              }
              inputProps={{ min: 0, step: "1" }}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
            <TextField
              label="Cash In Value"
              type="number"
              value={upsertForm.cashInValue}
              onChange={(event) =>
                setUpsertForm((prev) => ({ ...prev, cashInValue: Number(event.target.value) }))
              }
              inputProps={{ min: 0, step: "0.01" }}
              fullWidth
            />
            <TextField
              label="Cash Out Volume"
              type="number"
              value={upsertForm.cashOutVolume}
              onChange={(event) =>
                setUpsertForm((prev) => ({ ...prev, cashOutVolume: Number(event.target.value) }))
              }
              inputProps={{ min: 0, step: "1" }}
              fullWidth
            />
          </Stack>

          <TextField
            label="Cash Out Value"
            type="number"
            value={upsertForm.cashOutValue}
            onChange={(event) =>
              setUpsertForm((prev) => ({ ...prev, cashOutValue: Number(event.target.value) }))
            }
            inputProps={{ min: 0, step: "0.01" }}
          />

          {formError ? <Alert severity="warning">{formError}</Alert> : null}
          {!canWrite ? (
            <Typography variant="body2" color="text.secondary">
              Read-only role cannot save metric data.
            </Typography>
          ) : null}
        </Box>
      </Modal>
    </section>
  );
}
