import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, Search, Trash2, Users } from "lucide-react";

import { Card, CardHeader } from "../components/ui/Card";
import { Drawer } from "../components/ui/Drawer";
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
import { useAuth } from "../hooks/useAuth";
import { createBranch, deleteBranch, listBranches, updateBranch } from "../services/branches";
import {
  createRecipient,
  deleteRecipient,
  listRecipients,
  updateRecipient,
} from "../services/recipients";
import { getErrorMessage } from "../services/api";
import type { Branch, CreateBranchInput, CreateRecipientInput } from "../types/api";

const PAGE_SIZE = 10;

const INITIAL_FORM: CreateBranchInput = {
  city: "",
  label: "",
  address: "",
  isActive: true,
};

const INITIAL_RECIPIENT_FORM: CreateRecipientInput = {
  email: "",
  name: "",
  isActive: true,
};

export default function BranchesPage() {
  const queryClient = useQueryClient();
  const { canWrite } = useAuth();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateBranchInput>(INITIAL_FORM);
  const [formError, setFormError] = useState("");

  // Recipients drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [isAddRecipientOpen, setIsAddRecipientOpen] = useState(false);
  const [recipientForm, setRecipientForm] = useState<CreateRecipientInput>(INITIAL_RECIPIENT_FORM);
  const [recipientFormError, setRecipientFormError] = useState("");

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

  // Recipients queries and mutations
  const recipientsQuery = useQuery({
    queryKey: ["recipients", selectedBranch?.id],
    queryFn: () => listRecipients(selectedBranch!.id),
    enabled: drawerOpen && Boolean(selectedBranch),
  });

  const createRecipientMutation = useMutation({
    mutationFn: (input: CreateRecipientInput) =>
      createRecipient(selectedBranch!.id, input),
    onSuccess: () => {
      setIsAddRecipientOpen(false);
      setRecipientForm(INITIAL_RECIPIENT_FORM);
      setRecipientFormError("");
      queryClient.invalidateQueries({ queryKey: ["recipients", selectedBranch?.id] });
    },
  });

  const toggleRecipientMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateRecipient(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipients", selectedBranch?.id] });
    },
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: deleteRecipient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipients", selectedBranch?.id] });
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
    if (createRecipientMutation.isError) {
      return getErrorMessage(createRecipientMutation.error);
    }
    if (toggleRecipientMutation.isError) {
      return getErrorMessage(toggleRecipientMutation.error);
    }
    if (deleteRecipientMutation.isError) {
      return getErrorMessage(deleteRecipientMutation.error);
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
    createRecipientMutation.error,
    createRecipientMutation.isError,
    toggleRecipientMutation.error,
    toggleRecipientMutation.isError,
    deleteRecipientMutation.error,
    deleteRecipientMutation.isError,
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

  const openRecipientsDrawer = (branch: Branch) => {
    setSelectedBranch(branch);
    setDrawerOpen(true);
  };

  const closeRecipientsDrawer = () => {
    setDrawerOpen(false);
    setSelectedBranch(null);
    setIsAddRecipientOpen(false);
    setRecipientForm(INITIAL_RECIPIENT_FORM);
    setRecipientFormError("");
  };

  const submitAddRecipient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = recipientForm.email.trim();
    if (!email) {
      setRecipientFormError("Email is required.");
      return;
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setRecipientFormError("Invalid email format.");
      return;
    }

    setRecipientFormError("");
    createRecipientMutation.mutate({
      email,
      name: recipientForm.name?.trim() || undefined,
      isActive: recipientForm.isActive,
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
              disabled={!canWrite}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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
                        onClick={() => openRecipientsDrawer(branch)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Users className="h-3.5 w-3.5" />
                        Recipients
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleMutation.mutate({
                            id: branch.id,
                            nextValue: !branch.isActive,
                          })
                        }
                        disabled={!canWrite || toggleMutation.isPending}
                        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
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
                        disabled={!canWrite || deleteMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-300 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
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
              disabled={!canWrite || createMutation.isPending}
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
                disabled={!canWrite}
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
                disabled={!canWrite}
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
              disabled={!canWrite}
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
              disabled={!canWrite}
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

      {/* Recipients Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={closeRecipientsDrawer}
        title={selectedBranch ? `${selectedBranch.displayName} - Recipients` : "Recipients"}
      >
        <div className="space-y-4">
          {/* Add Recipient Button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Configure email recipients for this branch's alerts.
            </p>
            <button
              type="button"
              onClick={() => setIsAddRecipientOpen(true)}
              disabled={!canWrite}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          {/* Add Recipient Form */}
          {isAddRecipientOpen && canWrite && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <form onSubmit={submitAddRecipient} className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={recipientForm.email}
                    onChange={(e) =>
                      setRecipientForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="recipient@example.com"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Name (optional)
                  </label>
                  <input
                    type="text"
                    value={recipientForm.name || ""}
                    onChange={(e) =>
                      setRecipientForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="John Doe"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={recipientForm.isActive ?? true}
                    onChange={(e) =>
                      setRecipientForm((prev) => ({ ...prev, isActive: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Active (receives alerts)
                </label>

                {recipientFormError && (
                  <p className="text-sm text-rose-600">{recipientFormError}</p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={!canWrite || createRecipientMutation.isPending}
                    className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    {createRecipientMutation.isPending ? "Adding..." : "Add Recipient"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddRecipientOpen(false);
                      setRecipientForm(INITIAL_RECIPIENT_FORM);
                      setRecipientFormError("");
                    }}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Recipients List */}
          {recipientsQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading recipients...</p>
          ) : recipientsQuery.isError ? (
            <p className="text-sm text-rose-600">
              {getErrorMessage(recipientsQuery.error)}
            </p>
          ) : recipientsQuery.data?.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 p-6 text-center">
              <Mail className="mx-auto mb-2 h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-500">No recipients configured.</p>
              <p className="text-xs text-slate-400">
                Add recipients to receive alert emails for this branch.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recipientsQuery.data?.map((recipient) => (
                <div
                  key={recipient.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        recipient.isActive
                          ? "bg-emerald-100 text-emerald-600"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {recipient.email}
                      </p>
                      {recipient.name && (
                        <p className="text-xs text-slate-500">{recipient.name}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        toggleRecipientMutation.mutate({
                          id: recipient.id,
                          isActive: !recipient.isActive,
                        })
                      }
                      disabled={!canWrite || toggleRecipientMutation.isPending}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                        recipient.isActive
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {recipient.isActive ? "Active" : "Inactive"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const confirmed = window.confirm(
                          `Remove ${recipient.email} from recipients?`
                        );
                        if (confirmed) {
                          deleteRecipientMutation.mutate(recipient.id);
                        }
                      }}
                      disabled={!canWrite || deleteRecipientMutation.isPending}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Drawer>
    </section>
  );
}

