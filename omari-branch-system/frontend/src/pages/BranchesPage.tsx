import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Plus, Search, Trash2, Users } from "lucide-react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { Modal } from "../components/ui/Modal";
import { Pagination } from "../components/ui/Pagination";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";
import { createBranch, deleteBranch, listBranches, updateBranch } from "../services/branches";
import {
  createRecipient,
  deleteRecipient,
  listRecipients,
  updateRecipient,
} from "../services/recipients";
import { ConfirmDialog } from "../shared/components/ConfirmDialog";
import { DrawerPanel } from "../shared/components/DrawerPanel";
import { EmptyState } from "../shared/components/EmptyState";
import { FilterBar } from "../shared/components/FilterBar";
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
  const [searchParams, setSearchParams] = useSearchParams();

  const initialPage = (() => {
    const parsed = Number(searchParams.get("page"));
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  })();
  const initialSearch = searchParams.get("search") ?? "";

  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState(initialPage);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateBranchInput>(INITIAL_FORM);
  const [formError, setFormError] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [isAddRecipientOpen, setIsAddRecipientOpen] = useState(false);
  const [recipientForm, setRecipientForm] = useState<CreateRecipientInput>(INITIAL_RECIPIENT_FORM);
  const [recipientFormError, setRecipientFormError] = useState("");
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [recipientToDelete, setRecipientToDelete] = useState<{ id: string; email: string } | null>(
    null,
  );

  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch) {
      next.set("search", debouncedSearch);
    }
    if (page > 1) {
      next.set("page", String(page));
    }
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, page, setSearchParams]);

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
      setBranchToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });

  const recipientsQuery = useQuery({
    queryKey: ["recipients", selectedBranch?.id],
    queryFn: () => listRecipients(selectedBranch!.id),
    enabled: drawerOpen && Boolean(selectedBranch),
  });

  const createRecipientMutation = useMutation({
    mutationFn: (input: CreateRecipientInput) => createRecipient(selectedBranch!.id, input),
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
      setRecipientToDelete(null);
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
    <section className="space-y-5 motion-fade-up">
      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          disabled={!canWrite}
          onClick={() => setIsCreateOpen(true)}
        >
          Create Branch
        </Button>
      </Stack>

      <FilterBar>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
          <TextField
            size="small"
            fullWidth
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by city or label"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} />
                </InputAdornment>
              ),
            }}
          />
          {search ? (
            <Button
              variant="outlined"
              onClick={() => setSearch("")}
              sx={{ width: { xs: "100%", sm: "auto" }, whiteSpace: "nowrap" }}
            >
              Reset
            </Button>
          ) : null}
        </Stack>
      </FilterBar>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Paper sx={{ borderRadius: 3, border: "1px solid rgba(15, 23, 42, 0.1)", overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>City</TableCell>
                <TableCell>Label</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {branchesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    Loading branches...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                    <EmptyState
                      title="No branches found"
                      description="Try a different search term or create the first branch."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((branch) => (
                  <TableRow hover key={branch.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{branch.city}</TableCell>
                    <TableCell>{branch.label}</TableCell>
                    <TableCell>{branch.address || "-"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={branch.isActive ? "success" : "default"}
                        label={branch.isActive ? "ACTIVE" : "INACTIVE"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" spacing={0.8}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Users size={14} />}
                          onClick={() => openRecipientsDrawer(branch)}
                        >
                          Recipients
                        </Button>
                        <Tooltip title={branch.isActive ? "Deactivate branch" : "Activate branch"}>
                          <span>
                            <Switch
                              size="small"
                              checked={branch.isActive}
                              disabled={!canWrite || toggleMutation.isPending}
                              onChange={(_event, checked) => {
                                toggleMutation.mutate({
                                  id: branch.id,
                                  nextValue: checked,
                                });
                              }}
                            />
                          </span>
                        </Tooltip>
                        {canWrite ? (
                          <Tooltip title="Delete branch">
                            <span>
                              <IconButton
                                color="error"
                                size="small"
                                onClick={() => setBranchToDelete(branch)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 size={14} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : null}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

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
          <>
            <Button variant="text" color="secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-branch-form"
              variant="contained"
              disabled={!canWrite || createMutation.isPending}
            >
              {createMutation.isPending ? "Saving..." : "Save Branch"}
            </Button>
          </>
        }
      >
        <Box component="form" id="create-branch-form" sx={{ mt: 1, display: "grid", gap: 2 }} onSubmit={submitCreate}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="City"
              value={form.city}
              disabled={!canWrite}
              onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="Label"
              value={form.label}
              disabled={!canWrite}
              onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
              fullWidth
              size="small"
            />
          </Stack>

          <TextField
            label="Address"
            value={form.address || ""}
            disabled={!canWrite}
            onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
            fullWidth
            size="small"
          />

          <FormControlLabel
            control={
              <Switch
                checked={form.isActive ?? true}
                disabled={!canWrite}
                onChange={(_event, checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
              />
            }
            label="Active branch"
          />

          {formError ? <Alert severity="warning">{formError}</Alert> : null}
        </Box>
      </Modal>

      <DrawerPanel
        open={drawerOpen}
        onClose={closeRecipientsDrawer}
        title={selectedBranch ? `${selectedBranch.displayName} Recipients` : "Recipients"}
        width={820}
      >
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
            <Typography variant="body2" color="text.secondary">
              Configure recipients for branch-level alert notifications.
            </Typography>
            {canWrite ? (
              <Button
                size="small"
                variant="contained"
                startIcon={<Plus size={14} />}
                onClick={() => setIsAddRecipientOpen((prev) => !prev)}
              >
                {isAddRecipientOpen ? "Close Form" : "Add Recipient"}
              </Button>
            ) : null}
          </Stack>

          {isAddRecipientOpen && canWrite ? (
            <Paper sx={{ p: 2, border: "1px solid rgba(15, 23, 42, 0.1)" }}>
              <Box component="form" onSubmit={submitAddRecipient} sx={{ display: "grid", gap: 1.5 }}>
                <TextField
                  label="Email"
                  type="email"
                  size="small"
                  value={recipientForm.email}
                  onChange={(event) =>
                    setRecipientForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  placeholder="recipient@example.com"
                  required
                />
                <TextField
                  label="Name (optional)"
                  size="small"
                  value={recipientForm.name || ""}
                  onChange={(event) =>
                    setRecipientForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={recipientForm.isActive ?? true}
                      onChange={(_event, checked) =>
                        setRecipientForm((prev) => ({ ...prev, isActive: checked }))
                      }
                    />
                  }
                  label="Active recipient"
                />
                {recipientFormError ? <Alert severity="warning">{recipientFormError}</Alert> : null}
                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                  <Button
                    type="button"
                    variant="text"
                    color="secondary"
                    onClick={() => {
                      setIsAddRecipientOpen(false);
                      setRecipientForm(INITIAL_RECIPIENT_FORM);
                      setRecipientFormError("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={createRecipientMutation.isPending}
                  >
                    {createRecipientMutation.isPending ? "Adding..." : "Add Recipient"}
                  </Button>
                </Stack>
              </Box>
            </Paper>
          ) : null}

          {recipientsQuery.isLoading ? (
            <Typography variant="body2" color="text.secondary">
              Loading recipients...
            </Typography>
          ) : recipientsQuery.isError ? (
            <Alert severity="error">{getErrorMessage(recipientsQuery.error)}</Alert>
          ) : recipientsQuery.data?.length === 0 ? (
            <EmptyState
              title="No recipients configured"
              description="Add recipient emails to receive alert notifications for this branch."
              icon={<Mail size={18} />}
            />
          ) : (
            <Stack spacing={1}>
              {recipientsQuery.data?.map((recipient) => (
                <Paper
                  key={recipient.id}
                  sx={{
                    px: 1.5,
                    py: 1.1,
                    border: "1px solid rgba(15, 23, 42, 0.1)",
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          bgcolor: recipient.isActive ? "rgba(22, 163, 74, 0.14)" : "rgba(100, 116, 139, 0.14)",
                          color: recipient.isActive ? "success.main" : "text.secondary",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Mail size={14} />
                      </Box>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {recipient.email}
                        </Typography>
                        {recipient.name ? (
                          <Typography variant="caption" color="text.secondary">
                            {recipient.name}
                          </Typography>
                        ) : null}
                      </Box>
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Chip
                        size="small"
                        color={recipient.isActive ? "success" : "default"}
                        label={recipient.isActive ? "ACTIVE" : "INACTIVE"}
                      />
                      {canWrite ? (
                        <>
                          <Switch
                            size="small"
                            checked={recipient.isActive}
                            disabled={toggleRecipientMutation.isPending}
                            onChange={(_event, checked) =>
                              toggleRecipientMutation.mutate({ id: recipient.id, isActive: checked })
                            }
                          />
                          <Tooltip title="Remove recipient">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() =>
                                  setRecipientToDelete({ id: recipient.id, email: recipient.email })
                                }
                                disabled={deleteRecipientMutation.isPending}
                              >
                                <Trash2 size={14} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </>
                      ) : null}
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </DrawerPanel>

      <ConfirmDialog
        open={Boolean(branchToDelete)}
        title="Delete Branch"
        message={`Delete ${branchToDelete?.displayName ?? "this branch"}? This action cannot be undone.`}
        confirmLabel="Delete"
        onClose={() => setBranchToDelete(null)}
        onConfirm={() => {
          if (branchToDelete) {
            deleteMutation.mutate(branchToDelete.id);
          }
        }}
        loading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={Boolean(recipientToDelete)}
        title="Remove Recipient"
        message={`Remove ${recipientToDelete?.email ?? "this recipient"} from alerts?`}
        confirmLabel="Remove"
        onClose={() => setRecipientToDelete(null)}
        onConfirm={() => {
          if (recipientToDelete) {
            deleteRecipientMutation.mutate(recipientToDelete.id);
          }
        }}
        loading={deleteRecipientMutation.isPending}
      />
    </section>
  );
}
