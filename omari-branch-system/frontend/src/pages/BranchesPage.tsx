import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";

import { Card, CardHeader } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
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
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { createBranch, deleteBranch, listBranches, updateBranch } from "../services/branches";
import { getErrorMessage } from "../services/api";
import type { CreateBranchInput } from "../types/api";

const PAGE_SIZE = 10;

const INITIAL_FORM: CreateBranchInput = {
  city: "",
  label: "",
  address: "",
  isActive: true,
};

export default function BranchesPage() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateBranchInput>(INITIAL_FORM);
  const [formError, setFormError] = useState("");

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const branchesQuery = useQuery({
    queryKey: ["branches", { page, pageSize: PAGE_SIZE, search: debouncedSearch }],
    queryFn: () =>
      listBranches({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
      }),
  });

  const createMutation = useMutation({
    mutationFn: createBranch,
    onSuccess: () => {
      setIsCreateOpen(false);
      setForm(INITIAL_FORM);
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, nextValue }: { id: string; nextValue: boolean }) =>
      updateBranch(id, { isActive: nextValue }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBranch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });

  const rows = branchesQuery.data?.items ?? [];

  const errorMessage = useMemo(() => {
    if (branchesQuery.isError) {
      return getErrorMessage(branchesQuery.error);
    }
    if (createMutation.isError) {
      return getErrorMessage(createMutation.error);
    }
    if (toggleMutation.isError) {
      return getErrorMessage(toggleMutation.error);
    }
    if (deleteMutation.isError) {
      return getErrorMessage(deleteMutation.error);
    }
    return "";
  }, [
    branchesQuery.error,
    branchesQuery.isError,
    createMutation.error,
    createMutation.isError,
    deleteMutation.error,
    deleteMutation.isError,
    toggleMutation.error,
    toggleMutation.isError,
  ]);

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.city.trim() || !form.label.trim()) {
      setFormError("City and label are required.");
      return;
    }

    setFormError("");

    createMutation.mutate({
      city: form.city.trim(),
      label: form.label.trim(),
      address: form.address?.trim() || undefined,
      isActive: form.isActive,
    });
  };

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader
          title="Branches"
          subtitle="Manage branch locations and active states"
          actions={
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Create Branch
            </button>
          }
        />

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by city or label"
            className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          />
        </div>
      </Card>

      {errorMessage ? (
        <Card>
          <p className="text-sm text-rose-600">{errorMessage}</p>
        </Card>
      ) : null}

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>City</TableHeadCell>
              <TableHeadCell>Label</TableHeadCell>
              <TableHeadCell>Address</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell className="text-right">Actions</TableHeadCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {branchesQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  Loading branches...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500">
                  No branches found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((branch) => (
                <TableRow key={branch.id} className="hover:bg-slate-50">
                  <TableCell className="font-medium text-slate-900">{branch.city}</TableCell>
                  <TableCell>{branch.label}</TableCell>
                  <TableCell>{branch.address || "-"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        branch.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {branch.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          toggleMutation.mutate({
                            id: branch.id,
                            nextValue: !branch.isActive,
                          })
                        }
                        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {branch.isActive ? "Deactivate" : "Activate"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const confirmed = window.confirm(
                            `Delete ${branch.displayName}? This cannot be undone.`,
                          );
                          if (confirmed) {
                            deleteMutation.mutate(branch.id);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Pagination
        page={branchesQuery.data?.page ?? page}
        pageSize={branchesQuery.data?.pageSize ?? PAGE_SIZE}
        total={branchesQuery.data?.total ?? 0}
        onPageChange={setPage}
      />

      <Modal
        open={isCreateOpen}
        title="Create Branch"
        onClose={() => {
          setIsCreateOpen(false);
          setFormError("");
        }}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-branch-form"
              disabled={createMutation.isPending}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {createMutation.isPending ? "Saving..." : "Save Branch"}
            </button>
          </div>
        }
      >
        <form id="create-branch-form" className="space-y-4" onSubmit={submitCreate}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">City</label>
              <input
                value={form.city}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, city: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Label</label>
              <input
                value={form.label}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, label: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Address</label>
            <input
              value={form.address || ""}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, address: event.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive ?? true}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, isActive: event.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            Active branch
          </label>

          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}
        </form>
      </Modal>
    </section>
  );
}
