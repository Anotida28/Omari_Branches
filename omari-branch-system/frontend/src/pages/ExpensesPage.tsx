import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
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
  Tooltip,
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
  createPayment,
  deleteDocumentById,
  getExpenseById,
  listExpenses,
  uploadDocument,
} from "../services/expenses";
import { formatCurrency, formatDate, formatDateTime, toMoneyNumber } from "../services/format";
import { ConfirmDialog } from "../shared/components/ConfirmDialog";
import { DrawerPanel } from "../shared/components/DrawerPanel";
import { EmptyState } from "../shared/components/EmptyState";
import { FilterBar } from "../shared/components/FilterBar";
import type {
  CreateExpenseInput,
  CreatePaymentInput,
  DocumentType,
  ExpenseStatus,
  ExpenseType,
} from "../types/api";

const PAGE_SIZE = 10;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const EXPENSE_TYPES: ExpenseType[] = ["RENT", "ZESA", "WIFI", "OTHER"];
const EXPENSE_STATUSES: ExpenseStatus[] = ["PENDING", "PAID", "OVERDUE"];
const DOCUMENT_TYPES: DocumentType[] = ["INVOICE", "RECEIPT", "OTHER"];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:4000";

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

const INITIAL_PAYMENT_FORM: CreatePaymentInput = {
  paidDate: new Date().toISOString().slice(0, 10),
  amountPaid: 0,
  currency: "USD",
  reference: "",
  notes: "",
};

type DocumentUploadForm = {
  docType: DocumentType;
  uploadedBy: string;
};

const INITIAL_DOCUMENT_FORM: DocumentUploadForm = {
  docType: "INVOICE",
  uploadedBy: "",
};

function resolveDocumentUrl(documentId: string, storageKey: string): string {
  if (/^https?:\/\//i.test(storageKey)) {
    return storageKey;
  }

  const base = API_BASE_URL.replace(/\/+$/, "");
  return `${base}/api/documents/${documentId}/open`;
}

function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}

function statusColor(status: ExpenseStatus): "warning" | "success" | "error" {
  if (status === "PAID") {
    return "success";
  }
  if (status === "OVERDUE") {
    return "error";
  }
  return "warning";
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
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "");
  const [period, setPeriod] = useState(() => searchParams.get("period") ?? "");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<CreateExpenseInput>(INITIAL_EXPENSE_FORM);
  const [expenseFormError, setExpenseFormError] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);

  const [paymentForm, setPaymentForm] = useState<CreatePaymentInput>(INITIAL_PAYMENT_FORM);
  const [documentForm, setDocumentForm] = useState<DocumentUploadForm>({
    ...INITIAL_DOCUMENT_FORM,
    uploadedBy: user?.username ?? "",
  });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentFormError, setDocumentFormError] = useState("");
  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; fileName: string } | null>(
    null,
  );

  useEffect(() => {
    if (!selectedExpenseId) {
      setPaymentForm(INITIAL_PAYMENT_FORM);
      setDocumentForm({
        ...INITIAL_DOCUMENT_FORM,
        uploadedBy: user?.username ?? "",
      });
      setDocumentFile(null);
      setDocumentFormError("");
    }
  }, [selectedExpenseId, user?.username]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (page > 1) {
      next.set("page", String(page));
    }
    if (branchId) {
      next.set("branchId", branchId);
    }
    if (status) {
      next.set("status", status);
    }
    if (period) {
      next.set("period", period);
    }
    setSearchParams(next, { replace: true });
  }, [branchId, page, period, setSearchParams, status]);

  const branchesQuery = useQuery({
    queryKey: ["branches", "all", "for-expenses"],
    queryFn: () => listBranches({ page: 1, pageSize: 100 }),
  });

  const expensesQuery = useQuery({
    queryKey: ["expenses", { page, branchId, status, period }],
    queryFn: () =>
      listExpenses({
        page,
        pageSize: PAGE_SIZE,
        branchId: branchId || undefined,
        status: (status || undefined) as ExpenseStatus | undefined,
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

  const addPaymentMutation = useMutation({
    mutationFn: ({ expenseId, payload }: { expenseId: string; payload: CreatePaymentInput }) =>
      createPayment(expenseId, payload),
    onSuccess: (_, variables) => {
      setPaymentForm(INITIAL_PAYMENT_FORM);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense", variables.expenseId] });
    },
  });

  const addDocumentMutation = useMutation({
    mutationFn: uploadDocument,
    onSuccess: () => {
      setDocumentForm({
        ...INITIAL_DOCUMENT_FORM,
        uploadedBy: user?.username ?? "",
      });
      setDocumentFile(null);
      setDocumentFormError("");
      if (selectedExpenseId) {
        queryClient.invalidateQueries({ queryKey: ["expense", selectedExpenseId] });
      }
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: deleteDocumentById,
    onSuccess: () => {
      setDocumentToDelete(null);
      if (selectedExpenseId) {
        queryClient.invalidateQueries({ queryKey: ["expense", selectedExpenseId] });
      }
    },
  });

  const branchMap = useMemo(() => {
    return new Map((branchesQuery.data?.items ?? []).map((branch) => [branch.id, branch.displayName]));
  }, [branchesQuery.data?.items]);

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
    if (addPaymentMutation.isError) {
      return getErrorMessage(addPaymentMutation.error);
    }
    if (addDocumentMutation.isError) {
      return getErrorMessage(addDocumentMutation.error);
    }
    if (deleteDocumentMutation.isError) {
      return getErrorMessage(deleteDocumentMutation.error);
    }
    return "";
  })();

  const onCreateExpenseSubmit = (event: FormEvent<HTMLFormElement>) => {
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
    });
  };

  const onPaymentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canWrite || !selectedExpenseId) {
      return;
    }

    addPaymentMutation.mutate({
      expenseId: selectedExpenseId,
      payload: {
        ...paymentForm,
        amountPaid: Number(paymentForm.amountPaid),
        currency: (paymentForm.currency || "USD").toUpperCase(),
        reference: paymentForm.reference?.trim() || undefined,
        notes: paymentForm.notes?.trim() || undefined,
      },
    });
  };

  const onDocumentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canWrite || !selectedExpenseId) {
      return;
    }

    if (!documentFile) {
      setDocumentFormError("Select a file to upload.");
      return;
    }

    if (documentFile.size > MAX_FILE_SIZE_BYTES) {
      setDocumentFormError(
        `File is too large. Maximum allowed size is ${formatBytes(MAX_FILE_SIZE_BYTES)}.`,
      );
      return;
    }

    setDocumentFormError("");

    addDocumentMutation.mutate({
      file: documentFile,
      ...documentForm,
      expenseId: selectedExpenseId,
      uploadedBy: documentForm.uploadedBy?.trim() || undefined,
    });
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    setExpenseFormError("");
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedExpenseId(null);
    setDocumentToDelete(null);
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
          Create Expense
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
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            sx={{ minWidth: { xs: "100%", lg: 180 } }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {EXPENSE_STATUSES.map((item) => (
              <MenuItem key={item} value={item}>
                {item}
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
              setStatus("");
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
                <TableCell align="right">Paid</TableCell>
                <TableCell align="right">Balance</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expensesQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    Loading expenses...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ py: 5 }}>
                    <EmptyState
                      icon={<FileText size={18} />}
                      title="No expenses found"
                      description="Adjust filters or create an expense record."
                      actionLabel={canWrite ? "Create Expense" : undefined}
                      onAction={canWrite ? () => setIsCreateOpen(true) : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((expense) => (
                  <TableRow
                    hover
                    key={expense.id}
                    onClick={() => {
                      setSelectedExpenseId(expense.id);
                      setDrawerOpen(true);
                    }}
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
                    <TableCell align="right">
                      {formatCurrency(toMoneyNumber(expense.totalPaid), expense.currency)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatCurrency(toMoneyNumber(expense.balanceRemaining), expense.currency)}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" color={statusColor(expense.status)} label={expense.status} />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedExpenseId(expense.id);
                          setDrawerOpen(true);
                        }}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Pagination
        page={expensesQuery.data?.page ?? page}
        pageSize={expensesQuery.data?.pageSize ?? PAGE_SIZE}
        total={expensesQuery.data?.total ?? 0}
        onPageChange={setPage}
      />

      <Modal
        open={isCreateOpen}
        title="Create Expense"
        onClose={closeCreateModal}
        footer={
          <>
            <Button variant="text" color="secondary" onClick={closeCreateModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="create-expense-form"
              variant="contained"
              disabled={!canWrite || createExpenseMutation.isPending}
            >
              {createExpenseMutation.isPending ? "Saving..." : "Save Expense"}
            </Button>
          </>
        }
      >
        <Box
          component="form"
          id="create-expense-form"
          sx={{ mt: 1, display: "grid", gap: 1.6 }}
          onSubmit={onCreateExpenseSubmit}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.6}>
            <TextField
              select
              size="small"
              label="Branch"
              value={expenseForm.branchId}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, branchId: event.target.value }))
              }
              fullWidth
              required
            >
              <MenuItem value="">Select branch</MenuItem>
              {(branchesQuery.data?.items ?? []).map((branch) => (
                <MenuItem key={branch.id} value={branch.id}>
                  {branch.displayName}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Expense Type"
              value={expenseForm.expenseType}
              onChange={(event) =>
                setExpenseForm((prev) => ({
                  ...prev,
                  expenseType: event.target.value as ExpenseType,
                }))
              }
              fullWidth
            >
              {EXPENSE_TYPES.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.6}>
            <TextField
              size="small"
              label="Period"
              type="month"
              value={expenseForm.period}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, period: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              size="small"
              label="Due Date"
              type="date"
              value={expenseForm.dueDate}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, dueDate: event.target.value }))
              }
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.6}>
            <TextField
              size="small"
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
            />
            <TextField
              size="small"
              label="Currency"
              value={expenseForm.currency || "USD"}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, currency: event.target.value }))
              }
              inputProps={{ maxLength: 3 }}
              fullWidth
            />
          </Stack>

          <TextField
            size="small"
            label="Vendor"
            value={expenseForm.vendor || ""}
            onChange={(event) =>
              setExpenseForm((prev) => ({ ...prev, vendor: event.target.value }))
            }
            fullWidth
          />

          <TextField
            size="small"
            label="Notes"
            value={expenseForm.notes || ""}
            onChange={(event) =>
              setExpenseForm((prev) => ({ ...prev, notes: event.target.value }))
            }
            fullWidth
            multiline
            minRows={2}
          />

          {expenseFormError ? <Alert severity="warning">{expenseFormError}</Alert> : null}
        </Box>
      </Modal>

      <DrawerPanel
        open={drawerOpen}
        onClose={closeDrawer}
        title={detailQuery.data ? `Expense ${detailQuery.data.period}` : "Expense Detail"}
        width={920}
      >
        {detailQuery.isLoading ? (
          <Typography variant="body2" color="text.secondary">
            Loading expense detail...
          </Typography>
        ) : !detailQuery.data ? (
          <EmptyState title="No expense selected" description="Select an expense to view details." />
        ) : (
          <Stack spacing={2.2}>
            <Paper sx={{ p: 2, border: "1px solid rgba(15, 23, 42, 0.1)" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.4 }}>
                Summary
              </Typography>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
                  gap: 1.2,
                }}
              >
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
                    Status
                  </Typography>
                  <Box sx={{ mt: 0.4 }}>
                    <Chip size="small" color={statusColor(detailQuery.data.status)} label={detailQuery.data.status} />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Amount
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(toMoneyNumber(detailQuery.data.amount), detailQuery.data.currency)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Paid
                  </Typography>
                  <Typography variant="body2">
                    {formatCurrency(toMoneyNumber(detailQuery.data.totalPaid), detailQuery.data.currency)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Balance
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {formatCurrency(
                      toMoneyNumber(detailQuery.data.balanceRemaining),
                      detailQuery.data.currency,
                    )}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Vendor
                  </Typography>
                  <Typography variant="body2">{detailQuery.data.vendor || "-"}</Typography>
                </Box>
              </Box>
              {detailQuery.data.notes ? (
                <>
                  <Divider sx={{ my: 1.3 }} />
                  <Typography variant="body2" color="text.secondary">
                    {detailQuery.data.notes}
                  </Typography>
                </>
              ) : null}
            </Paper>

            <Paper sx={{ p: 2, border: "1px solid rgba(15, 23, 42, 0.1)" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.4 }}>
                Payments
              </Typography>

              <TableContainer sx={{ border: "1px solid rgba(15, 23, 42, 0.1)", borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Paid Date</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Reference</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detailQuery.data.payments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3, color: "text.secondary" }}>
                          No payments added yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      detailQuery.data.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{formatDate(payment.paidDate)}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(toMoneyNumber(payment.amountPaid), payment.currency)}
                          </TableCell>
                          <TableCell>{payment.reference || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {canWrite ? (
                <Box
                  component="form"
                  onSubmit={onPaymentSubmit}
                  sx={{ mt: 1.6, display: "grid", gap: 1.2 }}
                >
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                    <TextField
                      size="small"
                      type="date"
                      label="Paid Date"
                      value={paymentForm.paidDate}
                      onChange={(event) =>
                        setPaymentForm((prev) => ({ ...prev, paidDate: event.target.value }))
                      }
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="Amount Paid"
                      value={paymentForm.amountPaid}
                      onChange={(event) =>
                        setPaymentForm((prev) => ({
                          ...prev,
                          amountPaid: Number(event.target.value),
                        }))
                      }
                      inputProps={{ min: 0, step: "0.01" }}
                      fullWidth
                    />
                  </Stack>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                    <TextField
                      size="small"
                      label="Currency"
                      value={paymentForm.currency || "USD"}
                      onChange={(event) =>
                        setPaymentForm((prev) => ({ ...prev, currency: event.target.value }))
                      }
                      inputProps={{ maxLength: 3 }}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="Reference"
                      value={paymentForm.reference || ""}
                      onChange={(event) =>
                        setPaymentForm((prev) => ({ ...prev, reference: event.target.value }))
                      }
                      fullWidth
                    />
                  </Stack>
                  <TextField
                    size="small"
                    label="Notes"
                    value={paymentForm.notes || ""}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))
                    }
                    fullWidth
                  />
                  <Stack direction="row" justifyContent="flex-end">
                    <Button type="submit" variant="contained" disabled={addPaymentMutation.isPending}>
                      {addPaymentMutation.isPending ? "Adding..." : "Add Payment"}
                    </Button>
                  </Stack>
                </Box>
              ) : null}
            </Paper>

            <Paper sx={{ p: 2, border: "1px solid rgba(15, 23, 42, 0.1)" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.4 }}>
                Documents
              </Typography>

              <TableContainer sx={{ border: "1px solid rgba(15, 23, 42, 0.1)", borderRadius: 2 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>File</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Uploaded</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {detailQuery.data.documents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3, color: "text.secondary" }}>
                          No documents uploaded.
                        </TableCell>
                      </TableRow>
                    ) : (
                      detailQuery.data.documents.map((document) => (
                        <TableRow key={document.id}>
                          <TableCell>{document.docType}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.8} alignItems="center">
                              <FileText size={15} />
                              <a
                                href={resolveDocumentUrl(document.id, document.storageKey)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-700 hover:underline"
                              >
                                {document.fileName}
                              </a>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            {document.sizeBytes ? formatBytes(Number(document.sizeBytes) || 0) : "-"}
                          </TableCell>
                          <TableCell>{formatDateTime(document.uploadedAt)}</TableCell>
                          <TableCell align="right">
                            {canWrite ? (
                              <Tooltip title="Delete document">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="error"
                                    disabled={deleteDocumentMutation.isPending}
                                    onClick={() =>
                                      setDocumentToDelete({
                                        id: document.id,
                                        fileName: document.fileName,
                                      })
                                    }
                                  >
                                    <Trash2 size={14} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {canWrite ? (
                <Box
                  component="form"
                  onSubmit={onDocumentSubmit}
                  sx={{ mt: 1.6, display: "grid", gap: 1.2 }}
                >
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2}>
                    <TextField
                      select
                      size="small"
                      label="Document Type"
                      value={documentForm.docType}
                      onChange={(event) =>
                        setDocumentForm((prev) => ({
                          ...prev,
                          docType: event.target.value as DocumentType,
                        }))
                      }
                      fullWidth
                    >
                      {DOCUMENT_TYPES.map((item) => (
                        <MenuItem key={item} value={item}>
                          {item}
                        </MenuItem>
                      ))}
                    </TextField>
                    <TextField
                      size="small"
                      label="Uploaded By"
                      value={documentForm.uploadedBy}
                      onChange={(event) =>
                        setDocumentForm((prev) => ({
                          ...prev,
                          uploadedBy: event.target.value,
                        }))
                      }
                      fullWidth
                    />
                  </Stack>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems="center">
                    <Button component="label" variant="outlined" startIcon={<Upload size={16} />}>
                      Choose File
                      <input
                        hidden
                        type="file"
                        onChange={(event) => {
                          setDocumentFile(event.target.files?.[0] ?? null);
                          setDocumentFormError("");
                        }}
                      />
                    </Button>
                    <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
                      {documentFile
                        ? `${documentFile.name} (${formatBytes(documentFile.size)})`
                        : "No file selected"}
                    </Typography>
                  </Stack>

                  {documentFormError ? <Alert severity="warning">{documentFormError}</Alert> : null}

                  <Stack direction="row" justifyContent="flex-end">
                    <Button type="submit" variant="contained" disabled={addDocumentMutation.isPending}>
                      {addDocumentMutation.isPending ? "Uploading..." : "Upload Document"}
                    </Button>
                  </Stack>
                </Box>
              ) : null}
            </Paper>
          </Stack>
        )}
      </DrawerPanel>

      <ConfirmDialog
        open={Boolean(documentToDelete)}
        title="Delete Document"
        message={
          documentToDelete
            ? `Delete "${documentToDelete.fileName}"? This action cannot be undone.`
            : "Delete this document?"
        }
        confirmLabel="Delete"
        onConfirm={() => {
          if (documentToDelete) {
            deleteDocumentMutation.mutate(documentToDelete.id);
          }
        }}
        onClose={() => setDocumentToDelete(null)}
        loading={deleteDocumentMutation.isPending}
      />
    </section>
  );
}
