import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
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
} from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { Modal } from "../components/ui/Modal";
import { Pagination } from "../components/ui/Pagination";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";
import {
  createBranch,
  deleteBranch,
  listBranches,
  updateBranch,
  validateBranchAgentLine,
} from "../services/branches";
import { ConfirmDialog } from "../shared/components/ConfirmDialog";
import { EmptyState } from "../shared/components/EmptyState";
import { FilterBar } from "../shared/components/FilterBar";
import { TableSkeletonRows } from "../shared/components/TableSkeletonRows";
import type { Branch, CreateBranchInput, SourceAgentReference } from "../types/api";

const PAGE_SIZE = 10;

function createInitialForm(): CreateBranchInput {
  return {
    city: "",
    label: "",
    address: "",
    isActive: true,
    agentLineNumbers: [],
  };
}

type AgentLineFeedback = {
  severity: "success" | "warning" | "error" | "info";
  message: string;
  lineNumber?: string;
  sourceAgent?: SourceAgentReference | null;
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
  const [form, setForm] = useState<CreateBranchInput>(createInitialForm);
  const [agentLineInput, setAgentLineInput] = useState("");
  const [agentLineFeedback, setAgentLineFeedback] = useState<AgentLineFeedback | null>(
    null,
  );
  const [formError, setFormError] = useState("");
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);

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
      resetCreateForm();
      queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });

  const validateLineMutation = useMutation({
    mutationFn: (lineNumber: string) => validateBranchAgentLine(lineNumber),
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

  const rows = branchesQuery.data?.items ?? [];

  const resetCreateForm = () => {
    setForm(createInitialForm());
    setAgentLineInput("");
    setAgentLineFeedback(null);
    setFormError("");
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    resetCreateForm();
  };

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

    const approvedAgentLines = form.agentLineNumbers ?? [];

    if (approvedAgentLines.length === 0) {
      setFormError("At least one agent line number is required.");
      return;
    }

    setFormError("");
    createMutation.mutate({
      city: form.city.trim(),
      label: form.label.trim(),
      address: form.address?.trim() || undefined,
      isActive: form.isActive,
      agentLineNumbers: approvedAgentLines,
    });
  };

  const handleCheckAndAddAgentLine = async () => {
    const lineNumber = agentLineInput.trim();

    if (!lineNumber) {
      setAgentLineFeedback({
        severity: "warning",
        message: "Enter one agent line number to check.",
      });
      return;
    }

    if ((form.agentLineNumbers ?? []).includes(lineNumber)) {
      setAgentLineFeedback({
        severity: "warning",
        lineNumber,
        message: "This line has already been added to the branch.",
      });
      return;
    }

    setFormError("");

    try {
      const result = await validateLineMutation.mutateAsync(lineNumber);
      if (!result.isAvailable) {
        setAgentLineFeedback({
          severity:
            result.status === "already_assigned" ? "warning" : "error",
          lineNumber: result.lineNumber,
          message: result.message,
          sourceAgent: result.sourceAgent,
        });
        return;
      }

      setForm((prev) => ({
        ...prev,
        agentLineNumbers: [...(prev.agentLineNumbers ?? []), result.lineNumber],
      }));
      setAgentLineInput("");
      setAgentLineFeedback({
        severity: result.status === "unverified" ? "info" : "success",
        lineNumber: result.lineNumber,
        message: result.message,
        sourceAgent: result.sourceAgent,
      });
    } catch (error) {
      setAgentLineFeedback({
        severity: "error",
        lineNumber,
        message: getErrorMessage(error),
      });
    }
  };

  const removeAgentLine = (lineNumber: string) => {
    setForm((prev) => ({
      ...prev,
      agentLineNumbers: (prev.agentLineNumbers ?? []).filter(
        (currentLine) => currentLine !== lineNumber,
      ),
    }));
  };

  return (
    <section className="space-y-5 motion-fade-up">
      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          disabled={!canWrite}
          onClick={() => {
            resetCreateForm();
            setIsCreateOpen(true);
          }}
        >
          Create Branch
        </Button>
      </Stack>

      <Alert severity="info" variant="outlined">
        Reminder recipients are managed centrally in Settings and apply to all branches.
      </Alert>

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
                <TableCell>Agent Lines</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {branchesQuery.isLoading ? (
                <TableSkeletonRows columns={6} />
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
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
                    <TableCell>
                      {branch.agentLines.length > 0
                        ? branch.agentLines.map((line) => line.lineNumber).join(", ")
                        : "-"}
                    </TableCell>
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
        onClose={closeCreateModal}
        footer={
          <>
            <Button variant="text" color="secondary" onClick={closeCreateModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-branch-form"
              variant="contained"
              disabled={!canWrite || createMutation.isPending || validateLineMutation.isPending}
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

          <TextField
            label="Add Agent Line"
            placeholder="Enter one agent line number"
            value={agentLineInput}
            disabled={!canWrite}
            onChange={(event) => setAgentLineInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCheckAndAddAgentLine();
              }
            }}
            helperText="Add one line at a time. The system checks the source DB before approving it."
            fullWidth
            size="small"
          />

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            alignItems={{ sm: "center" }}
          >
            <Button
              type="button"
              variant="outlined"
              disabled={!canWrite || validateLineMutation.isPending}
              onClick={() => {
                void handleCheckAndAddAgentLine();
              }}
            >
              {validateLineMutation.isPending ? "Checking..." : "Check & Add Line"}
            </Button>
            <Box sx={{ color: "text.secondary", fontSize: 13 }}>
              Approved lines: {(form.agentLineNumbers ?? []).length}
            </Box>
          </Stack>

          {agentLineFeedback ? (
            <Alert severity={agentLineFeedback.severity}>
              <Stack spacing={0.5}>
                <span>{agentLineFeedback.message}</span>
                {agentLineFeedback.sourceAgent ? (
                  <Box sx={{ fontSize: 13 }}>
                    Account: {agentLineFeedback.sourceAgent.agentAccount}
                    {agentLineFeedback.sourceAgent.fullName
                      ? ` | Name: ${agentLineFeedback.sourceAgent.fullName}`
                      : ""}
                    {agentLineFeedback.sourceAgent.mobileNumber
                      ? ` | Mobile: ${agentLineFeedback.sourceAgent.mobileNumber}`
                      : ""}
                  </Box>
                ) : null}
              </Stack>
            </Alert>
          ) : null}

          <Stack spacing={1}>
            <Box sx={{ color: "text.secondary", fontSize: 13, fontWeight: 600 }}>
              Approved agent lines
            </Box>
            {(form.agentLineNumbers ?? []).length > 0 ? (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {(form.agentLineNumbers ?? []).map((lineNumber) => (
                  <Chip
                    key={lineNumber}
                    label={lineNumber}
                    color="success"
                    variant="outlined"
                    onDelete={
                      canWrite
                        ? () => {
                            removeAgentLine(lineNumber);
                          }
                        : undefined
                    }
                  />
                ))}
              </Stack>
            ) : (
              <Box sx={{ color: "text.secondary", fontSize: 13 }}>
                No agent lines have been approved yet.
              </Box>
            )}
          </Stack>

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
    </section>
  );
}
