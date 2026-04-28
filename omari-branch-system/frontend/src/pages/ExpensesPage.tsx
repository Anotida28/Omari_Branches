import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
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
  Typography,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { Modal } from "../components/ui/Modal";
import { Pagination } from "../components/ui/Pagination";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";
import { listBranches } from "../services/branches";
import { formatCurrency, formatDate, formatDateTime, toMoneyNumber } from "../services/format";
import {
  createRecurringReminder,
  deleteRecurringReminder,
  getRecurringReminderById,
  listRecurringReminders,
  updateRecurringReminder,
} from "../services/recurringReminders";
import { ConfirmDialog } from "../shared/components/ConfirmDialog";
import { DrawerPanel } from "../shared/components/DrawerPanel";
import { EmptyState } from "../shared/components/EmptyState";
import { FilterBar } from "../shared/components/FilterBar";
import type {
  CreateRecurringReminderInput,
  ExpenseType,
  UpdateRecurringReminderInput,
} from "../types/api";

const PAGE_SIZE = 10;
const EXPENSE_TYPES: ExpenseType[] = ["RENT", "ZESA", "WIFI", "OTHER"];

const INITIAL_FORM: CreateRecurringReminderInput = {
  branchId: "",
  expenseType: "RENT",
  dueDayOfMonth: 1,
  amount: 0,
  currency: "USD",
  vendor: "",
  notes: "",
  isActive: true,
};

function getDueDayLabel(day: number): string {
  if (day === 1 || day === 21 || day === 31) return `${day}st`;
  if (day === 2 || day === 22) return `${day}nd`;
  if (day === 3 || day === 23) return `${day}rd`;
  return `${day}th`;
}

function getReminderState(nextDueDate: string): { label: string; color: "success" | "warning" | "error" } {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const due = new Date(nextDueDate);
  const days = Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (days < 0) return { label: `${Math.abs(days)} days overdue`, color: "error" };
  if (days === 0) return { label: "Due today", color: "warning" };
  if (days <= 7) return { label: `Due in ${days} days`, color: "warning" };
  return { label: `Due in ${days} days`, color: "success" };
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
  const [isActive, setIsActive] = useState(() => searchParams.get("isActive") ?? "");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateRecurringReminderInput>(INITIAL_FORM);
  const [formError, setFormError] = useState("");

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<UpdateRecurringReminderInput>(INITIAL_FORM);
  const [editFormError, setEditFormError] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reminderToDelete, setReminderToDelete] = useState<{ id: string; label: string } | null>(null);

  useEffect(() => {
    const next = new URLSearchParams();
    if (page > 1) next.set("page", String(page));
    if (branchId) next.set("branchId", branchId);
    if (isActive) next.set("isActive", isActive);
    setSearchParams(next, { replace: true });
  }, [branchId, isActive, page, setSearchParams]);

  const branchesQuery = useQuery({
    queryKey: ["branches", "all", "for-recurring-reminders"],
    queryFn: () => listBranches({ page: 1, pageSize: 100 }),
  });

  const remindersQuery = useQuery({
    queryKey: ["recurring-reminders", { page, branchId, isActive }],
    queryFn: () =>
      listRecurringReminders({
        page,
        pageSize: PAGE_SIZE,
        branchId: branchId || undefined,
        isActive: isActive ? isActive === "true" : undefined,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["recurring-reminder", selectedId],
    queryFn: () => getRecurringReminderById(selectedId as string),
    enabled: drawerOpen && Boolean(selectedId),
  });

  const createMutation = useMutation({
    mutationFn: createRecurringReminder,
    onSuccess: () => {
      setIsCreateOpen(false);
      setForm(INITIAL_FORM);
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["recurring-reminders"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRecurringReminderInput }) =>
      updateRecurringReminder(id, payload),
    onSuccess: (_, variables) => {
      setIsEditOpen(false);
      setEditForm(INITIAL_FORM);
      setEditFormError("");
      queryClient.invalidateQueries({ queryKey: ["recurring-reminders"] });
      queryClient.invalidateQueries({ queryKey: ["recurring-reminder", variables.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecurringReminder,
    onSuccess: () => {
      setReminderToDelete(null);
      setDrawerOpen(false);
      setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["recurring-reminders"] });
    },
  });

  const branchMap = useMemo(
    () => new Map((branchesQuery.data?.items ?? []).map((branch) => [branch.id, branch.displayName])),
    [branchesQuery.data?.items],
  );

  const combinedError = (() => {
    if (branchesQuery.isError) return getErrorMessage(branchesQuery.error);
    if (remindersQuery.isError) return getErrorMessage(remindersQuery.error);
    if (detailQuery.isError) return getErrorMessage(detailQuery.error);
    if (createMutation.isError) return getErrorMessage(createMutation.error);
    if (updateMutation.isError) return getErrorMessage(updateMutation.error);
    if (deleteMutation.isError) return getErrorMessage(deleteMutation.error);
    return "";
  })();

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) return;
    if (!form.branchId) {
      setFormError("Branch is required.");
      return;
    }
    setFormError("");
    createMutation.mutate({
      ...form,
      amount: Number(form.amount),
      currency: (form.currency || "USD").toUpperCase(),
      vendor: form.vendor?.trim() || undefined,
      notes: form.notes?.trim() || undefined,
      createdBy: user?.username ?? undefined,
    });
  };

  const submitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite || !selectedId) return;
    setEditFormError("");
    updateMutation.mutate({
      id: selectedId,
      payload: {
        ...editForm,
        amount: Number(editForm.amount ?? 0),
        currency: (editForm.currency || "USD").toUpperCase(),
        vendor: editForm.vendor?.trim() || undefined,
        notes: editForm.notes?.trim() || undefined,
      },
    });
  };

  const openEditModal = () => {
    if (!detailQuery.data) return;
    setEditForm({
      branchId: detailQuery.data.branchId,
      expenseType: detailQuery.data.expenseType,
      dueDayOfMonth: detailQuery.data.dueDayOfMonth,
      amount: toMoneyNumber(detailQuery.data.amount),
      currency: detailQuery.data.currency,
      vendor: detailQuery.data.vendor ?? "",
      notes: detailQuery.data.notes ?? "",
      isActive: detailQuery.data.isActive,
    });
    setEditFormError("");
    setIsEditOpen(true);
  };

  const rows = remindersQuery.data?.items ?? [];

  const renderReminderForm = (
    values: CreateRecurringReminderInput | UpdateRecurringReminderInput,
    setValues: Dispatch<SetStateAction<any>>,
  ) => (
    <Stack spacing={2}>
      <TextField
        select
        label="Branch"
        value={values.branchId ?? ""}
        onChange={(event) => setValues((prev: any) => ({ ...prev, branchId: event.target.value }))}
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
          value={values.expenseType ?? "RENT"}
          onChange={(event) => setValues((prev: any) => ({ ...prev, expenseType: event.target.value as ExpenseType }))}
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
          label="Due Day Each Month"
          type="number"
          value={values.dueDayOfMonth ?? 1}
          onChange={(event) => setValues((prev: any) => ({ ...prev, dueDayOfMonth: Number(event.target.value) }))}
          inputProps={{ min: 1, max: 31, step: 1 }}
          fullWidth
          required
        />
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField
          label="Amount"
          type="number"
          value={values.amount ?? 0}
          onChange={(event) => setValues((prev: any) => ({ ...prev, amount: Number(event.target.value) }))}
          inputProps={{ min: 0, step: "0.01" }}
          fullWidth
          required
        />
        <TextField
          label="Currency"
          value={values.currency ?? "USD"}
          onChange={(event) => setValues((prev: any) => ({ ...prev, currency: event.target.value }))}
          inputProps={{ maxLength: 3 }}
          fullWidth
        />
      </Stack>

      <TextField
        label="Vendor"
        value={values.vendor ?? ""}
        onChange={(event) => setValues((prev: any) => ({ ...prev, vendor: event.target.value }))}
        fullWidth
      />
      <TextField
        label="Notes"
        value={values.notes ?? ""}
        onChange={(event) => setValues((prev: any) => ({ ...prev, notes: event.target.value }))}
        multiline
        minRows={3}
        fullWidth
      />
      <FormControlLabel
        control={
          <Switch
            checked={values.isActive ?? true}
            onChange={(_event, checked) => setValues((prev: any) => ({ ...prev, isActive: checked }))}
          />
        }
        label="Active monthly reminder"
      />
    </Stack>
  );

  return (
    <section className="space-y-5 motion-fade-up">
      <Stack direction="row" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={<Plus size={16} />}
          disabled={!canWrite}
          onClick={() => setIsCreateOpen(true)}
        >
          Create Monthly Reminder
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
            select
            size="small"
            label="Status"
            value={isActive}
            onChange={(event) => {
              setIsActive(event.target.value);
              setPage(1);
            }}
            sx={{ minWidth: { xs: "100%", lg: 160 } }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="true">Active</MenuItem>
            <MenuItem value="false">Paused</MenuItem>
          </TextField>
          <Button
            variant="outlined"
            onClick={() => {
              setBranchId("");
              setIsActive("");
              setPage(1);
            }}
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
                <TableCell>Due Day</TableCell>
                <TableCell>Next Due</TableCell>
                <TableCell>Next Reminder</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {remindersQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    Loading monthly reminders...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 5 }}>
                    <EmptyState
                      icon={<CalendarClock size={18} />}
                      title="No monthly reminders found"
                      description="Create one monthly reminder for each recurring branch expense."
                      actionLabel={canWrite ? "Create Monthly Reminder" : undefined}
                      onAction={canWrite ? () => setIsCreateOpen(true) : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((reminder) => {
                  const state = getReminderState(reminder.nextDueDate);
                  return (
                    <TableRow
                      hover
                      key={reminder.id}
                      onClick={() => {
                        setSelectedId(reminder.id);
                        setDrawerOpen(true);
                      }}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell sx={{ fontWeight: 600 }}>{branchMap.get(reminder.branchId) ?? reminder.branchId}</TableCell>
                      <TableCell>{reminder.expenseType}</TableCell>
                      <TableCell>{getDueDayLabel(reminder.dueDayOfMonth)}</TableCell>
                      <TableCell>{formatDate(reminder.nextDueDate)}</TableCell>
                      <TableCell>{reminder.nextReminderDate ? formatDate(reminder.nextReminderDate) : "-"}</TableCell>
                      <TableCell align="right">{formatCurrency(toMoneyNumber(reminder.amount), reminder.currency)}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.6}>
                          <Chip size="small" color={reminder.isActive ? state.color : "default"} label={reminder.isActive ? state.label : "Paused"} />
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {remindersQuery.data ? (
        <Pagination
          page={page}
          total={remindersQuery.data.total}
          pageSize={remindersQuery.data.pageSize}
          onPageChange={setPage}
        />
      ) : null}

      <Modal open={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create Monthly Reminder">
        <Box component="form" onSubmit={submitCreate} className="space-y-4">
          <Typography variant="body2" color="text.secondary">
            Set this once. The system calculates the due date every month and sends scheduled emails.
          </Typography>
          {renderReminderForm(form, setForm)}
          {formError ? <Alert severity="warning">{formError}</Alert> : null}
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="outlined" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create Reminder"}
            </Button>
          </Stack>
        </Box>
      </Modal>

      <Modal open={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Monthly Reminder">
        <Box component="form" onSubmit={submitEdit} className="space-y-4">
          {renderReminderForm(editForm, setEditForm)}
          {editFormError ? <Alert severity="warning">{editFormError}</Alert> : null}
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            <Button variant="outlined" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </Stack>
        </Box>
      </Modal>

      <DrawerPanel
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedId(null);
          setReminderToDelete(null);
        }}
        title={detailQuery.data ? `${detailQuery.data.expenseType} Monthly Reminder` : "Monthly Reminder"}
        width={760}
      >
        {detailQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">Loading reminder detail...</Typography>
        ) : !detailQuery.data ? (
          <EmptyState title="No reminder selected" description="Select a reminder to view details." />
        ) : (
          <Stack spacing={2.2}>
            <Paper sx={{ p: 2, border: "1px solid rgba(15, 23, 42, 0.1)" }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1} sx={{ mb: 1.4 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Bell size={16} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Monthly Reminder Summary</Typography>
                </Stack>
                {canWrite ? (
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" startIcon={<Pencil size={14} />} onClick={openEditModal}>Edit</Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<Trash2 size={14} />}
                      onClick={() => setReminderToDelete({
                        id: detailQuery.data.id,
                        label: `${detailQuery.data.expenseType} for ${branchMap.get(detailQuery.data.branchId) ?? detailQuery.data.branchId}`,
                      })}
                    >
                      Delete
                    </Button>
                  </Stack>
                ) : null}
              </Stack>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 1.2 }}>
                <Box><Typography variant="caption" color="text.secondary">Branch</Typography><Typography variant="body2">{branchMap.get(detailQuery.data.branchId) ?? detailQuery.data.branchId}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Type</Typography><Typography variant="body2">{detailQuery.data.expenseType}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Due Day</Typography><Typography variant="body2">{getDueDayLabel(detailQuery.data.dueDayOfMonth)} of every month</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Next Due</Typography><Typography variant="body2">{formatDate(detailQuery.data.nextDueDate)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Next Reminder</Typography><Typography variant="body2">{detailQuery.data.nextReminderDate ? formatDate(detailQuery.data.nextReminderDate) : "-"}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Amount</Typography><Typography variant="body2" sx={{ fontWeight: 700 }}>{formatCurrency(toMoneyNumber(detailQuery.data.amount), detailQuery.data.currency)}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Vendor</Typography><Typography variant="body2">{detailQuery.data.vendor || "-"}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Status</Typography><Typography variant="body2">{detailQuery.data.isActive ? "Active" : "Paused"}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Updated</Typography><Typography variant="body2">{formatDateTime(detailQuery.data.updatedAt)}</Typography></Box>
              </Box>

              {detailQuery.data.notes ? (
                <>
                  <Divider sx={{ my: 1.3 }} />
                  <Typography variant="caption" color="text.secondary">Notes</Typography>
                  <Typography variant="body2" color="text.secondary">{detailQuery.data.notes}</Typography>
                </>
              ) : null}
            </Paper>
          </Stack>
        )}
      </DrawerPanel>

      <ConfirmDialog
        open={Boolean(reminderToDelete)}
        title="Delete Monthly Reminder"
        message={reminderToDelete ? `Delete ${reminderToDelete.label}? Future monthly emails for it will stop.` : "Delete this monthly reminder?"}
        confirmLabel="Delete"
        onConfirm={() => {
          if (reminderToDelete) deleteMutation.mutate(reminderToDelete.id);
        }}
        onClose={() => setReminderToDelete(null)}
        loading={deleteMutation.isPending}
      />
    </section>
  );
}
