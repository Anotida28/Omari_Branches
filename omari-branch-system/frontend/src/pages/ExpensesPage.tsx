import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
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
import {
  createExpense,
  deleteExpense,
  getExpenseById,
  listExpenses,
  updateExpense,
} from "../services/expenses";
import { formatCurrency, formatDate, formatDateTime, toMoneyNumber } from "../services/format";
import { ConfirmDialog } from "../shared/components/ConfirmDialog";
import { DrawerPanel } from "../shared/components/DrawerPanel";
import { EmptyState } from "../shared/components/EmptyState";
import { FilterBar } from "../shared/components/FilterBar";
import type {
  CreateExpenseInput,
  ExpenseType,
  UpdateExpenseInput,
} from "../types/api";

const PAGE_SIZE = 10;
const EXPENSE_TYPES: ExpenseType[] = ["RENT", "ZESA", "WIFI", "OTHER"];

const INITIAL_EXPENSE_FORM: CreateExpenseInput = {
  branchId: "",
  expenseType: "RENT",
  period: new Date().toISOString().slice(0, 7),
  dueDate: new Date().toISOString().slice(0, 10),
  amount: 0,
  currency: "USD",
  vendor: "",
  notes: "",
};

const INITIAL_EDIT_EXPENSE_FORM: UpdateExpenseInput = {
  expenseType: "RENT",
  period: new Date().toISOString().slice(0, 7),
  dueDate: new Date().toISOString().slice(0, 10),
  amount: 0,
  currency: "USD",
  vendor: "",
  notes: "",
};

type ReminderState = {
  color: "default" | "warning" | "error";
  label: string;
};

function getReminderState(dueDate: string): ReminderState {
  const due = new Date(`${dueDate}T00:00:00.000Z`);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (due.getTime() < today.getTime()) {
    return { label: "OVERDUE", color: "error" };
  }

  if (due.getTime() === today.getTime()) {
    return { label: "DUE TODAY", color: "warning" };
  }

  return { label: "UPCOMING", color: "default" };
}

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const { canWrite, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(() => {
    const parsed = Number(searchParams.get("page"));
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  });
  const [branchId, setBranchId] = useState(() => searchParams.get("branchId") ?? "");
  const [period, setPeriod] = useState(() => searchParams.get("period") ?? "");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<CreateExpenseInput>(INITIAL_EXPENSE_FORM);
  const [expenseFormError, setExpenseFormError] = useState("");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editExpenseForm, setEditExpenseForm] = useState<UpdateExpenseInput>(INITIAL_EDIT_EXPENSE_FORM);
  const [editExpenseFormError, setEditExpenseFormError] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    const next = new URLSearchParams();
    if (page > 1) {
      next.set("page", String(page));
    }
    if (branchId) {
      next.set("branchId", branchId);
    }
    if (period) {
      next.set("period", period);
    }
    setSearchParams(next, { replace: true });
  }, [branchId, page, period, setSearchParams]);

  const branchesQuery = useQuery({
    queryKey: ["branches", "all", "for-expenses"],
    queryFn: () => listBranches({ page: 1, pageSize: 100 }),
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses", { page, branchId, period }],
    queryFn: () =>
      listExpenses({
        page,
        pageSize: PAGE_SIZE,
        branchId: branchId || undefined,
        period: period || undefined,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["expense", selectedExpenseId],
    queryFn: () => getExpenseById(selectedExpenseId as string),
    enabled: drawerOpen && Boolean(selectedExpenseId),
  });

  const createExpenseMutation = useMutation({
    mutationFn: createExpense,
    onSuccess: () => {
      setIsCreateOpen(false);
      setExpenseForm(INITIAL_EXPENSE_FORM);
      setExpenseFormError("");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ expenseId, payload }: { expenseId: string; payload: UpdateExpenseInput }) =>
      updateExpense(expenseId, payload),
    onSuccess: (_, variables) => {
      setIsEditOpen(false);
      setEditExpenseForm(INITIAL_EDIT_EXPENSE_FORM);
      setEditExpenseFormError("");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense", variables.expenseId] });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      setExpenseToDelete(null);
      closeDrawer();
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
  });

  const branchMap = useMemo(
    () => new Map((branchesQuery.data?.items ?? []).map((branch) => [branch.id, branch.displayName])),
    [branchesQuery.data?.items],
  );

  const combinedError = (() => {
    if (branchesQuery.isError) {
      return getErrorMessage(branchesQuery.error);
    }
    if (expensesQuery.isError) {
      return getErrorMessage(expensesQuery.error);
    }
    if (detailQuery.isError) {
      return getErrorMessage(detailQuery.error);
    }
    if (createExpenseMutation.isError) {
      return getErrorMessage(createExpenseMutation.error);
    }
    if (updateExpenseMutation.isError) {
      return getErrorMessage(updateExpenseMutation.error);
    }
    if (deleteExpenseMutation.isError) {
      return getErrorMessage(deleteExpenseMutation.error);
    }
    return "";
  })();

  const submitCreateExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canWrite) {
      return;
    }

    if (!expenseForm.branchId) {
      setExpenseFormError("Branch is required.");
      return;
    }

    if (!expenseForm.period || !expenseForm.dueDate) {
      setExpenseFormError("Period and due date are required.");
      return;
    }

    setExpenseFormError("");
    createExpenseMutation.mutate({
      ...expenseForm,
      amount: Number(expenseForm.amount),
      currency: (expenseForm.currency || "USD").toUpperCase(),
      vendor: expenseForm.vendor?.trim() || undefined,
      notes: expenseForm.notes?.trim() || undefined,
      createdBy: user?.username ?? undefined,
    });
  };

  const submitEditExpense = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canWrite || !selectedExpenseId) {
      return;
    }

    if (!editExpenseForm.period || !editExpenseForm.dueDate) {
      setEditExpenseFormError("Period and due date are required.");
      return;
    }

    if (editExpenseForm.amount === undefined || Number(editExpenseForm.amount) < 0) {
      setEditExpenseFormError("Amount must be zero or greater.");
      return;
    }

    setEditExpenseFormError("");
    updateExpenseMutation.mutate({
      expenseId: selectedExpenseId,
      payload: {
        expenseType: editExpenseForm.expenseType,
        period: editExpenseForm.period,
        dueDate: editExpenseForm.dueDate,
        amount: Number(editExpenseForm.amount),
        currency: (editExpenseForm.currency || "USD").toUpperCase(),
        vendor: editExpenseForm.vendor?.trim() || undefined,
        notes: editExpenseForm.notes?.trim() || undefined,
      },
    });
  };

  const openDetail = (expenseId: string) => {
    setSelectedExpenseId(expenseId);
    setDrawerOpen(true);
  };

  const openEditModal = () => {
    if (!detailQuery.data) {
      return;
    }

    setEditExpenseForm({
      expenseType: detailQuery.data.expenseType,
      period: detailQuery.data.period,
      dueDate: detailQuery.data.dueDate,
      amount: toMoneyNumber(detailQuery.data.amount),
      currency: detailQuery.data.currency,
      vendor: detailQuery.data.vendor ?? "",
      notes: detailQuery.data.notes ?? "",
    });
    setEditExpenseFormError("");
    setIsEditOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedExpenseId(null);
    setExpenseToDelete(null);
  };

  const rows = expensesQuery.data?.items ?? [];

  return (
    <section className="space-y-5 motion-fade-up">
      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          disabled={!canWrite}
          onClick={() => setIsCreateOpen(true)}
        >
          Create Reminder
        </Button>
      </Stack>

      <FilterBar>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
          <TextField
            select
            size="small"
            label="Branch"
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setPage(1);
            }}
            sx={{ minWidth: { xs: "100%", lg: 220 } }}
          >
            <MenuItem value="">All branches</MenuItem>
            {(branchesQuery.data?.items ?? []).map((branch) => (
              <MenuItem key={branch.id} value={branch.id}>
                {branch.displayName}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            label="Period"
            type="month"
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value);
              setPage(1);
            }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", lg: 170 } }}
          />

          <Button
            variant="outlined"
            onClick={() => {
              setBranchId("");
              setPeriod("");
              setPage(1);
            }}
            sx={{ whiteSpace: "nowrap", width: { xs: "100%", lg: "auto" } }}
          >
            Reset Filters
          </Button>
        </Stack>
      </FilterBar>

      {combinedError ? <Alert severity="error">{combinedError}</Alert> : null}

      <Paper sx={{ borderRadius: 3, border: "1px solid rgba(15, 23, 42, 0.1)", overflow: "hidden" }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Branch</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Period</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Reminder State</TableCell>
                <TableCell>Vendor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expensesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    Loading reminders...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 5 }}>
                    <EmptyState
                      icon={<FileText size={18} />}
                      title="No reminder items found"
                      description="Adjust filters or create a reminder record."
                      actionLabel={canWrite ? "Create Reminder" : undefined}
                      onAction={canWrite ? () => setIsCreateOpen(true) : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((expense) => {
                  const reminderState = getReminderState(expense.dueDate);

                  return (
                    <TableRow
                      hover
                      key={expense.id}
                      onClick={() => openDetail(expense.id)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell sx={{ fontWeight: 600 }}>
                        {branchMap.get(expense.branchId) ?? expense.branchId}
                      </TableCell>
                      <TableCell>{expense.expenseType}</TableCell>
                      <TableCell>{expense.period}</TableCell>
                      <TableCell>{formatDate(expense.dueDate)}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(toMoneyNumber(expense.amount), expense.currency)}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" color={reminderState.color} label={reminderState.label} />
                      </TableCell>
                      <TableCell>{expense.vendor || "-"}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {expensesQuery.data ? (
        <Pagination
          page={page}
          total={expensesQuery.data.total}
          pageSize={expensesQuery.data.pageSize}
          onPageChange={setPage}
        />
      ) : null}

      <Modal
        open={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setExpenseFormError("");
        }}
        title="Create Reminder"
      >
        <Box component="form" onSubmit={submitCreateExpense} className="space-y-4">
          <Typography variant="body2" color="text.secondary">
            Add a branch expense that should be included in reminder scheduling.
          </Typography>

          <TextField
            select
            label="Branch"
            value={expenseForm.branchId}
            onChange={(event) =>
              setExpenseForm((prev) => ({ ...prev, branchId: event.target.value }))
            }
            fullWidth
            required
          >
            {(branchesQuery.data?.items ?? []).map((branch) => (
              <MenuItem key={branch.id} value={branch.id}>
                {branch.displayName}
              </MenuItem>
            ))}
          </TextField>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              select
              label="Expense Type"
              value={expenseForm.expenseType}
              onChange={(event) =>
                setExpenseForm((prev) => ({
                  ...prev,
                  expenseType: event.target.value as ExpenseType,
                }))
              }
              fullWidth
              required
            >
              {EXPENSE_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Period"
              type="month"
              value={expenseForm.period}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, period: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              label="Due Date"
              type="date"
              value={expenseForm.dueDate}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, dueDate: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />

            <TextField
              label="Amount"
              type="number"
              value={expenseForm.amount}
              onChange={(event) =>
                setExpenseForm((prev) => ({
                  ...prev,
                  amount: Number(event.target.value),
                }))
              }
              inputProps={{ min: 0, step: "0.01" }}
              fullWidth
              required
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              label="Currency"
              value={expenseForm.currency || "USD"}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, currency: event.target.value }))
              }
              inputProps={{ maxLength: 3 }}
              fullWidth
            />

            <TextField
              label="Vendor"
              value={expenseForm.vendor || ""}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, vendor: event.target.value }))
              }
              fullWidth
            />
          </Stack>

          <TextField
            label="Notes"
            value={expenseForm.notes || ""}
            onChange={(event) =>
              setExpenseForm((prev) => ({ ...prev, notes: event.target.value }))
            }
            fullWidth
            multiline
            minRows={3}
          />

          {expenseFormError ? <Alert severity="warning">{expenseFormError}</Alert> : null}

          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="outlined" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={createExpenseMutation.isPending}>
              {createExpenseMutation.isPending ? "Saving..." : "Create Reminder"}
            </Button>
          </Stack>
        </Box>
      </Modal>

      <Modal
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditExpenseFormError("");
        }}
        title="Edit Reminder"
      >
        <Box component="form" onSubmit={submitEditExpense} className="space-y-4">
          <Typography variant="body2" color="text.secondary">
            Update the reminder record without the old payment and document workflow.
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              select
              label="Expense Type"
              value={editExpenseForm.expenseType ?? "RENT"}
              onChange={(event) =>
                setEditExpenseForm((prev) => ({
                  ...prev,
                  expenseType: event.target.value as ExpenseType,
                }))
              }
              fullWidth
              required
            >
              {EXPENSE_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Period"
              type="month"
              value={editExpenseForm.period ?? ""}
              onChange={(event) =>
                setEditExpenseForm((prev) => ({ ...prev, period: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              label="Due Date"
              type="date"
              value={editExpenseForm.dueDate ?? ""}
              onChange={(event) =>
                setEditExpenseForm((prev) => ({ ...prev, dueDate: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
              required
            />

            <TextField
              label="Amount"
              type="number"
              value={editExpenseForm.amount ?? 0}
              onChange={(event) =>
                setEditExpenseForm((prev) => ({
                  ...prev,
                  amount: Number(event.target.value),
                }))
              }
              inputProps={{ min: 0, step: "0.01" }}
              fullWidth
              required
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              label="Currency"
              value={editExpenseForm.currency ?? "USD"}
              onChange={(event) =>
                setEditExpenseForm((prev) => ({ ...prev, currency: event.target.value }))
              }
              inputProps={{ maxLength: 3 }}
              fullWidth
            />

            <TextField
              label="Vendor"
              value={editExpenseForm.vendor ?? ""}
              onChange={(event) =>
                setEditExpenseForm((prev) => ({ ...prev, vendor: event.target.value }))
              }
              fullWidth
            />
          </Stack>

          <TextField
            label="Notes"
            value={editExpenseForm.notes ?? ""}
            onChange={(event) =>
              setEditExpenseForm((prev) => ({ ...prev, notes: event.target.value }))
            }
            fullWidth
            multiline
            minRows={3}
          />

          {editExpenseFormError ? <Alert severity="warning">{editExpenseFormError}</Alert> : null}

          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="outlined" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={updateExpenseMutation.isPending}>
              {updateExpenseMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </Stack>
        </Box>
      </Modal>

      <DrawerPanel
        open={drawerOpen}
        onClose={closeDrawer}
        title={detailQuery.data ? `Reminder ${detailQuery.data.period}` : "Reminder Detail"}
        width={760}
      >
        {detailQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Loading reminder detail...
          </Typography>
        ) : !detailQuery.data ? (
          <EmptyState title="No reminder selected" description="Select a reminder to view details." />
        ) : (
          <Stack spacing={2.2}>
            <Paper sx={{ p: 2, border: "1px solid rgba(15, 23, 42, 0.1)" }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ sm: "center" }}
                spacing={1}
                sx={{ mb: 1.4 }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Reminder Summary
                </Typography>
                {canWrite ? (
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      startIcon={<Pencil size={14} />}
                      onClick={openEditModal}
                    >
                      Edit Reminder
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<Trash2 size={14} />}
                      onClick={() =>
                        setExpenseToDelete({
                          id: detailQuery.data.id,
                          label: `${detailQuery.data.expenseType} (${detailQuery.data.period})`,
                        })
                      }
                    >
                      Delete Reminder
                    </Button>
                  </Stack>
                ) : null}
              </Stack>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    sm: "repeat(2, minmax(0, 1fr))",
                    lg: "repeat(3, minmax(0, 1fr))",
                  },
                  gap: 1.2,
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Branch
                  </Typography>
                  <Typography variant="body2">
                    {branchMap.get(detailQuery.data.branchId) ?? detailQuery.data.branchId}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Type
                  </Typography>
                  <Typography variant="body2">{detailQuery.data.expenseType}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Period
                  </Typography>
                  <Typography variant="body2">{detailQuery.data.period}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Due Date
                  </Typography>
                  <Typography variant="body2">{formatDate(detailQuery.data.dueDate)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Reminder State
                  </Typography>
                  <Box sx={{ mt: 0.4 }}>
                    {(() => {
                      const reminderState = getReminderState(detailQuery.data.dueDate);
                      return (
                        <Chip size="small" color={reminderState.color} label={reminderState.label} />
                      );
                    })()}
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Amount
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formatCurrency(toMoneyNumber(detailQuery.data.amount), detailQuery.data.currency)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Vendor
                  </Typography>
                  <Typography variant="body2">{detailQuery.data.vendor || "-"}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Created By
                  </Typography>
                  <Typography variant="body2">{detailQuery.data.createdBy || "-"}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Updated
                  </Typography>
                  <Typography variant="body2">{formatDateTime(detailQuery.data.updatedAt)}</Typography>
                </Box>
              </Box>

              {detailQuery.data.notes ? (
                <>
                  <Divider sx={{ my: 1.3 }} />
                  <Typography variant="caption" color="text.secondary">
                    Notes
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {detailQuery.data.notes}
                  </Typography>
                </>
              ) : null}
            </Paper>
          </Stack>
        )}
      </DrawerPanel>

      <ConfirmDialog
        open={Boolean(expenseToDelete)}
        title="Delete Reminder"
        message={
          expenseToDelete
            ? `Delete ${expenseToDelete.label}? This will also remove any reminder logs already linked to it.`
            : "Delete this reminder?"
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (expenseToDelete) {
            deleteExpenseMutation.mutate(expenseToDelete.id);
          }
        }}
        onClose={() => setExpenseToDelete(null)}
        loading={deleteExpenseMutation.isPending}
      />
    </section>
  );
}
