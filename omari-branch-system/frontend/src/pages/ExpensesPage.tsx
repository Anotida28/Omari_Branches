import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import { ExpenseStatusBadge } from "../components/ui/Badge";
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
import { getErrorMessage } from "../services/api";
import { listBranches } from "../services/branches";
import {
  createDocument,
  createExpense,
  createPayment,
  getExpenseById,
  listExpenses,
} from "../services/expenses";
import { formatCurrency, formatDate, formatDateTime, toMoneyNumber } from "../services/format";
import type {
  CreateDocumentInput,
  CreateExpenseInput,
  CreatePaymentInput,
  DocumentType,
  ExpenseStatus,
  ExpenseType,
} from "../types/api";

const PAGE_SIZE = 10;
const EXPENSE_TYPES: ExpenseType[] = ["RENT", "ZESA", "WIFI", "OTHER"];
const EXPENSE_STATUSES: ExpenseStatus[] = ["PENDING", "PAID", "OVERDUE"];
const DOCUMENT_TYPES: DocumentType[] = ["INVOICE", "RECEIPT", "OTHER"];

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

const INITIAL_DOCUMENT_FORM: CreateDocumentInput = {
  fileName: "",
  mimeType: "application/pdf",
  sizeBytes: 0,
  storageKey: "",
  uploadedBy: "system",
  docType: "INVOICE",
};

export default function ExpensesPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [branchId, setBranchId] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState<CreateExpenseInput>(INITIAL_EXPENSE_FORM);
  const [expenseFormError, setExpenseFormError] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(null);

  const [paymentForm, setPaymentForm] = useState<CreatePaymentInput>(INITIAL_PAYMENT_FORM);
  const [documentForm, setDocumentForm] = useState<CreateDocumentInput>(INITIAL_DOCUMENT_FORM);
  const [documentFormError, setDocumentFormError] = useState("");

  useEffect(() => {
    if (!selectedExpenseId) {
      setPaymentForm(INITIAL_PAYMENT_FORM);
      setDocumentForm(INITIAL_DOCUMENT_FORM);
    }
  }, [selectedExpenseId]);

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
    mutationFn: createDocument,
    onSuccess: (_, variables) => {
      setDocumentForm(INITIAL_DOCUMENT_FORM);
      queryClient.invalidateQueries({ queryKey: ["expense", variables.expenseId] });
    },
  });

  const branchMap = useMemo(() => {
    return new Map(
      (branchesQuery.data?.items ?? []).map((branch) => [branch.id, branch.displayName]),
    );
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
    return "";
  })();

  const onCreateExpenseSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
    if (!selectedExpenseId) {
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
    if (!selectedExpenseId) {
      return;
    }

    const storageKey = documentForm.storageKey?.trim() ?? "";
    const url = documentForm.url?.trim() ?? "";

    if (!storageKey && !url) {
      setDocumentFormError("Provide a storage key or URL.");
      return;
    }

    setDocumentFormError("");

    addDocumentMutation.mutate({
      ...documentForm,
      sizeBytes: Number(documentForm.sizeBytes),
      storageKey: storageKey || url,
      url: undefined,
      fileName: documentForm.fileName.trim(),
      mimeType: documentForm.mimeType.trim(),
      expenseId: selectedExpenseId,
      uploadedBy: documentForm.uploadedBy?.trim() || undefined,
    });
  };

  return (
    <section className="space-y-4">
      <Card>
        <CardHeader
          title="Expenses"
          subtitle="Track expense lifecycle, balances, and payment activity"
          actions={
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Create Expense
            </button>
          }
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
            <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              {EXPENSE_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Period</label>
            <input
              type="month"
              value={period}
              onChange={(event) => {
                setPeriod(event.target.value);
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
                setStatus("");
                setPeriod("");
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

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Branch</TableHeadCell>
              <TableHeadCell>Expense Type</TableHeadCell>
              <TableHeadCell>Period</TableHeadCell>
              <TableHeadCell>Due Date</TableHeadCell>
              <TableHeadCell className="text-right">Amount</TableHeadCell>
              <TableHeadCell className="text-right">Paid</TableHeadCell>
              <TableHeadCell className="text-right">Balance</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {expensesQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500">
                  Loading expenses...
                </TableCell>
              </TableRow>
            ) : (expensesQuery.data?.items.length ?? 0) === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-slate-500">
                  No expenses found.
                </TableCell>
              </TableRow>
            ) : (
              expensesQuery.data?.items.map((expense) => (
                <TableRow
                  key={expense.id}
                  className="cursor-pointer hover:bg-slate-50"
                  onClick={() => {
                    setSelectedExpenseId(expense.id);
                    setDrawerOpen(true);
                  }}
                >
                  <TableCell className="font-medium text-slate-900">
                    {branchMap.get(expense.branchId) ?? expense.branchId}
                  </TableCell>
                  <TableCell>{expense.expenseType}</TableCell>
                  <TableCell>{expense.period}</TableCell>
                  <TableCell>{formatDate(expense.dueDate)}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(toMoneyNumber(expense.amount), expense.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(toMoneyNumber(expense.totalPaid), expense.currency)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-slate-900">
                    {formatCurrency(toMoneyNumber(expense.balanceRemaining), expense.currency)}
                  </TableCell>
                  <TableCell>
                    <ExpenseStatusBadge status={expense.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Pagination
        page={expensesQuery.data?.page ?? page}
        pageSize={expensesQuery.data?.pageSize ?? PAGE_SIZE}
        total={expensesQuery.data?.total ?? 0}
        onPageChange={setPage}
      />

      <Modal
        open={isCreateOpen}
        title="Create Expense"
        onClose={() => {
          setIsCreateOpen(false);
          setExpenseFormError("");
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
              form="create-expense-form"
              disabled={createExpenseMutation.isPending}
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {createExpenseMutation.isPending ? "Saving..." : "Save Expense"}
            </button>
          </div>
        }
      >
        <form id="create-expense-form" className="space-y-4" onSubmit={onCreateExpenseSubmit}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Branch</label>
              <select
                value={expenseForm.branchId}
                onChange={(event) =>
                  setExpenseForm((prev) => ({ ...prev, branchId: event.target.value }))
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
              <label className="mb-1 block text-sm font-medium text-slate-700">Expense Type</label>
              <select
                value={expenseForm.expenseType}
                onChange={(event) =>
                  setExpenseForm((prev) => ({
                    ...prev,
                    expenseType: event.target.value as ExpenseType,
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                {EXPENSE_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Period</label>
              <input
                type="month"
                value={expenseForm.period}
                onChange={(event) =>
                  setExpenseForm((prev) => ({ ...prev, period: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Due Date</label>
              <input
                type="date"
                value={expenseForm.dueDate}
                onChange={(event) =>
                  setExpenseForm((prev) => ({ ...prev, dueDate: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Amount</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={expenseForm.amount}
                onChange={(event) =>
                  setExpenseForm((prev) => ({
                    ...prev,
                    amount: Number(event.target.value),
                  }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
              <input
                value={expenseForm.currency || "USD"}
                onChange={(event) =>
                  setExpenseForm((prev) => ({ ...prev, currency: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                maxLength={3}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Vendor</label>
              <input
                value={expenseForm.vendor || ""}
                onChange={(event) =>
                  setExpenseForm((prev) => ({ ...prev, vendor: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
              <input
                value={expenseForm.notes || ""}
                onChange={(event) =>
                  setExpenseForm((prev) => ({ ...prev, notes: event.target.value }))
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {expenseFormError ? <p className="text-sm text-rose-600">{expenseFormError}</p> : null}
        </form>
      </Modal>

      <Drawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedExpenseId(null);
        }}
        title="Expense Detail"
      >
        {detailQuery.isLoading ? (
          <p className="text-sm text-slate-600">Loading expense detail...</p>
        ) : !detailQuery.data ? (
          <p className="text-sm text-slate-600">Select an expense to view details.</p>
        ) : (
          <div className="space-y-5">
            <Card>
              <CardHeader title="Summary" />
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
                <div>
                  <p className="text-slate-500">Expense Type</p>
                  <p className="font-medium text-slate-900">{detailQuery.data.expenseType}</p>
                </div>
                <div>
                  <p className="text-slate-500">Period</p>
                  <p className="font-medium text-slate-900">{detailQuery.data.period}</p>
                </div>
                <div>
                  <p className="text-slate-500">Due Date</p>
                  <p className="font-medium text-slate-900">{formatDate(detailQuery.data.dueDate)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Amount</p>
                  <p className="font-medium text-slate-900">
                    {formatCurrency(toMoneyNumber(detailQuery.data.amount), detailQuery.data.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Total Paid</p>
                  <p className="font-medium text-slate-900">
                    {formatCurrency(
                      toMoneyNumber(detailQuery.data.totalPaid),
                      detailQuery.data.currency,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Balance</p>
                  <p className="font-medium text-slate-900">
                    {formatCurrency(
                      toMoneyNumber(detailQuery.data.balanceRemaining),
                      detailQuery.data.currency,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <ExpenseStatusBadge status={detailQuery.data.status} />
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Payments" subtitle="Payment history for this expense" />

              <div className="mb-4 overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Date</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-slate-500">Amount</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {detailQuery.data.payments.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-center text-slate-500">
                          No payments yet.
                        </td>
                      </tr>
                    ) : (
                      detailQuery.data.payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-3 py-2 text-slate-700">{formatDate(payment.paidDate)}</td>
                          <td className="px-3 py-2 text-right text-slate-700">
                            {formatCurrency(toMoneyNumber(payment.amountPaid), payment.currency)}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{payment.reference || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <form onSubmit={onPaymentSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Paid Date</label>
                  <input
                    type="date"
                    value={paymentForm.paidDate}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({ ...prev, paidDate: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Amount Paid</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentForm.amountPaid}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({
                        ...prev,
                        amountPaid: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Currency</label>
                  <input
                    value={paymentForm.currency || "USD"}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({ ...prev, currency: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    maxLength={3}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Reference</label>
                  <input
                    value={paymentForm.reference || ""}
                    onChange={(event) =>
                      setPaymentForm((prev) => ({ ...prev, reference: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={addPaymentMutation.isPending}
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    {addPaymentMutation.isPending ? "Adding..." : "Add Payment"}
                  </button>
                </div>
              </form>
            </Card>

            <Card>
              <CardHeader title="Documents" subtitle="Expense attachments" />

              <div className="mb-4 overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Type</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">File</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-slate-500">Uploaded</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {detailQuery.data.documents.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-3 text-center text-slate-500">
                          No documents yet.
                        </td>
                      </tr>
                    ) : (
                      detailQuery.data.documents.map((document) => (
                        <tr key={document.id}>
                          <td className="px-3 py-2 text-slate-700">{document.docType}</td>
                          <td className="px-3 py-2 text-slate-700">{document.fileName}</td>
                          <td className="px-3 py-2 text-slate-700">{formatDateTime(document.uploadedAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <form onSubmit={onDocumentSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Document Type</label>
                  <select
                    value={documentForm.docType || "INVOICE"}
                    onChange={(event) =>
                      setDocumentForm((prev) => ({
                        ...prev,
                        docType: event.target.value as DocumentType,
                      }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    {DOCUMENT_TYPES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">File Name</label>
                  <input
                    value={documentForm.fileName || ""}
                    onChange={(event) =>
                      setDocumentForm((prev) => ({ ...prev, fileName: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Mime Type</label>
                  <input
                    value={documentForm.mimeType || ""}
                    onChange={(event) =>
                      setDocumentForm((prev) => ({ ...prev, mimeType: event.target.value }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Size (bytes)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={documentForm.sizeBytes}
                    onChange={(event) =>
                      setDocumentForm((prev) => ({
                        ...prev,
                        sizeBytes: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Storage Key</label>
                  <input
                    value={documentForm.storageKey || ""}
                    onChange={(event) =>
                      setDocumentForm((prev) => ({ ...prev, storageKey: event.target.value }))
                    }
                    placeholder="expenses/{id}/invoice.pdf"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Document URL</label>
                  <input
                    value={documentForm.url || ""}
                    onChange={(event) =>
                      setDocumentForm((prev) => ({ ...prev, url: event.target.value }))
                    }
                    placeholder="https://example.com/docs/invoice.pdf"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  {documentFormError ? (
                    <p className="mt-1 text-sm text-rose-600">{documentFormError}</p>
                  ) : null}
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={addDocumentMutation.isPending}
                    className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    {addDocumentMutation.isPending ? "Adding..." : "Add Document"}
                  </button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </Drawer>
    </section>
  );
}
