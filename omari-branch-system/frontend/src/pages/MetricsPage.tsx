import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Card, CardHeader } from "../components/ui/Card";
import { Pagination } from "../components/ui/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeadCell,
  TableRow,
} from "../components/ui/Table";
import { getErrorMessage } from "../services/api";
import { listBranches } from "../services/branches";
import { formatCurrency } from "../services/format";
import { deleteMetric, listMetrics, upsertMetric } from "../services/metrics";
import { useAuth } from "../hooks/useAuth";
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

export default function MetricsPage() {
  const queryClient = useQueryClient();
  const { canWrite } = useAuth();

  const [page, setPage] = useState(1);
  const [branchId, setBranchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [upsertForm, setUpsertForm] = useState<UpsertMetricInput>(DEFAULT_UPSERT);
  const [formError, setFormError] = useState("");

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
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMetric,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
  });

  const branchMap = useMemo(() => {
    return new Map(
      (branchesQuery.data?.items ?? []).map((branch) => [branch.id, branch.displayName]),
    );
  }, [branchesQuery.data?.items]);

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

  const combinedError = (() => {
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
    <section className="space-y-4">
      <Card>
        <CardHeader
          title="Metrics"
          subtitle="Branch cash movement and daily metric entries"
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Branch</label>
            <select
              value={branchId}
              onChange={(event) => {
                setBranchId(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All branches</option>
              {(branchesQuery.data?.items ?? []).map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setBranchId("");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </Card>

      {combinedError ? (
        <Card>
          <p className="text-sm text-rose-600">{combinedError}</p>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Upsert Metric"
          subtitle="Create or update by branch + date"
        />

        <form onSubmit={submitUpsert} className="space-y-3">
          {!canWrite ? (
            <p className="text-sm text-slate-500">Read-only access: metric updates are disabled.</p>
          ) : null}

          <fieldset disabled={!canWrite} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Branch</label>
              <select
                value={upsertForm.branchId}
                onChange={(event) =>
                  setUpsertForm((prev) => ({ ...prev, branchId: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select branch</option>
                {(branchesQuery.data?.items ?? []).map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Date</label>
              <input
                type="date"
                value={upsertForm.date}
                onChange={(event) =>
                  setUpsertForm((prev) => ({ ...prev, date: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cash Balance</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={upsertForm.cashBalance}
                onChange={(event) =>
                  setUpsertForm((prev) => ({
                    ...prev,
                    cashBalance: Number(event.target.value),
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">E-Float Balance</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={upsertForm.eFloatBalance}
                onChange={(event) =>
                  setUpsertForm((prev) => ({
                    ...prev,
                    eFloatBalance: Number(event.target.value),
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cash in Vault</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={upsertForm.cashInVault}
                onChange={(event) =>
                  setUpsertForm((prev) => ({
                    ...prev,
                    cashInVault: Number(event.target.value),
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cash In Volume</label>
              <input
                type="number"
                min="0"
                step="1"
                value={upsertForm.cashInVolume}
                onChange={(event) =>
                  setUpsertForm((prev) => ({
                    ...prev,
                    cashInVolume: Number(event.target.value),
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cash In Value</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={upsertForm.cashInValue}
                onChange={(event) =>
                  setUpsertForm((prev) => ({
                    ...prev,
                    cashInValue: Number(event.target.value),
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cash Out Volume</label>
              <input
                type="number"
                min="0"
                step="1"
                value={upsertForm.cashOutVolume}
                onChange={(event) =>
                  setUpsertForm((prev) => ({
                    ...prev,
                    cashOutVolume: Number(event.target.value),
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Cash Out Value</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={upsertForm.cashOutValue}
                onChange={(event) =>
                  setUpsertForm((prev) => ({
                    ...prev,
                    cashOutValue: Number(event.target.value),
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={upsertMutation.isPending}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {upsertMutation.isPending ? "Saving..." : "Upsert Metric"}
            </button>
          </div>
          </fieldset>
        </form>
      </Card>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Branch</TableHeadCell>
              <TableHeadCell>Date</TableHeadCell>
              <TableHeadCell className="text-right">Cash Balance</TableHeadCell>
              <TableHeadCell className="text-right">E-Float Balance</TableHeadCell>
              <TableHeadCell className="text-right">Cash in Vault</TableHeadCell>
              <TableHeadCell className="text-right">Cash on Branch</TableHeadCell>
              <TableHeadCell className="text-right">Cash In</TableHeadCell>
              <TableHeadCell className="text-right">Cash Out</TableHeadCell>
              <TableHeadCell className="text-right">Net Cash</TableHeadCell>
              <TableHeadCell className="text-right">Actions</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {metricsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-slate-500">
                  Loading metrics...
                </TableCell>
              </TableRow>
            ) : (metricsQuery.data?.items.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-slate-500">
                  No metrics found.
                </TableCell>
              </TableRow>
            ) : (
              metricsQuery.data?.items.map((metric) => (
                <TableRow key={metric.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-slate-900">
                    {branchMap.get(metric.branchId) ?? metric.branchId}
                  </TableCell>
                  <TableCell>{metric.date}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(metric.cashBalance))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(metric.eFloatBalance))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(metric.cashInVault))}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900">
                    {formatCurrency(Number(metric.cashOnBranch))}
                  </TableCell>
                  <TableCell className="text-right">
                    {metric.cashInVolume} / {formatCurrency(Number(metric.cashInValue))}
                  </TableCell>
                  <TableCell className="text-right">
                    {metric.cashOutVolume} / {formatCurrency(Number(metric.cashOutValue))}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900">
                    {formatCurrency(Number(metric.netCashValue))}
                  </TableCell>
                  <TableCell className="text-right">
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(metric.id)}
                      disabled={!canWrite || deleteMutation.isPending}
                      className="rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {deleteMutation.isPending ? "Deleting..." : "Delete"}
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Pagination
        page={metricsQuery.data?.page ?? page}
        pageSize={metricsQuery.data?.pageSize ?? PAGE_SIZE}
        total={metricsQuery.data?.total ?? 0}
        onPageChange={setPage}
      />
    </section>
  );
}

