"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Wallet as WalletIcon } from "lucide-react";
import type { GridColDef } from "@mui/x-data-grid";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import {
  ApiError,
  adminGetCustomerWalletTransactions,
  adminGetSettings,
  adminGetWalletCustomers,
  adminUpdateSettings,
} from "@/lib/api";
import { buildCsv, downloadCsv, fetchAllPages } from "@/lib/csv";
import {
  CustomDataGrid,
  type QueryType,
} from "@/components/admin/CustomDataGrid";
import { faDataGridLocaleText } from "@/components/admin/dataGridLocale";
import { digitsOnly } from "@/lib/formatNumber";
import {
  WALLET_TRANSACTION_TYPE_LABELS,
  type AdminCustomer,
  type AdminWalletTransaction,
} from "@/types/admin";

function CashbackPercentForm() {
  const [percent, setPercent] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    adminGetSettings()
      .then((s) => setPercent(String(s.walletCashbackPercent)))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      await adminUpdateSettings({ walletCashbackPercent: Number(percent) || 0 });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در ذخیره‌سازی");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-xl rounded-[1.5rem] border border-sand-100 bg-white p-5"
    >
      <h2 className="flex items-center gap-2 text-sm font-bold text-cocoa-900">
        <WalletIcon className="h-4.5 w-4.5 text-sand-500" />
        درصد پاداش خرید
      </h2>
      <p className="mt-1 text-xs text-cocoa-500">
        به ازای هر سفارش پرداخت‌شده، این درصد از جمع اقلام سفارش (بدون احتساب مالیات،
        تخفیف و هزینه ارسال) به کیف پول مشتری واریز می‌شود.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-cocoa-500">در حال بارگذاری…</p>
      ) : (
        <div className="mt-4 max-w-xs">
          <label className="mb-1 block text-xs font-semibold text-cocoa-600">
            درصد پاداش (٪)
          </label>
          <input
            type="text"
            inputMode="numeric"
            dir="ltr"
            value={percent}
            onChange={(e) => {
              const digits = digitsOnly(e.target.value);
              setPercent(digits === "" ? "" : String(Math.min(100, Number(digits))));
            }}
            className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
          />
        </div>
      )}

      {error && <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>}
      {success && <p className="mt-3 text-xs font-semibold text-sand-500">تغییرات ذخیره شد</p>}

      <button
        type="submit"
        disabled={saving || loading}
        className="mt-4 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
      >
        {saving ? "در حال ذخیره…" : "ذخیره تغییرات"}
      </button>
    </form>
  );
}

function AdminWalletPage() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomer | null>(null);
  const [transactions, setTransactions] = useState<AdminWalletTransaction[] | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const load = useCallback(() => {
    setLoading(true);
    adminGetWalletCustomers(page, pageSize, debouncedSearch)
      .then((res) => {
        setCustomers(res.items);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleQueryChange = useCallback((query: QueryType) => {
    setPage(query.page + 1);
    setPageSize(query.pageSize);
    setSearch((query.filterModel?.quickFilterValues ?? []).join(" "));
  }, []);

  const openTransactions = async (customer: AdminCustomer) => {
    setSelectedCustomer(customer);
    setTransactions(null);
    const res = await adminGetCustomerWalletTransactions(customer.id);
    setTransactions(res.items);
  };

  const columns = useMemo<GridColDef<AdminCustomer>[]>(
    () => [
      {
        field: "name",
        headerName: "نام",
        flex: 1,
        minWidth: 140,
        valueGetter: (_, row) =>
          [row.firstName, row.lastName].filter(Boolean).join(" ") || "بدون نام",
      },
      {
        field: "phone",
        headerName: "موبایل",
        width: 150,
        renderCell: ({ row }) => <span dir="ltr">{row.phone}</span>,
      },
      {
        field: "walletBalance",
        headerName: "موجودی کیف پول",
        width: 160,
        renderCell: ({ row }) => (
          <span className="rounded-full bg-sand-50 px-3 py-1 text-xs font-bold text-sand-500">
            {row.walletBalance.toLocaleString("fa-IR")} تومان
          </span>
        ),
      },
      {
        field: "actions",
        headerName: "عملیات",
        width: 100,
        sortable: false,
        filterable: false,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }) => (
          <div className="flex h-full w-full items-center justify-center">
            <button
              type="button"
              onClick={() => openTransactions(row)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-sand-100 text-cocoa-700 transition hover:bg-sand-50"
              aria-label="مشاهده تراکنش‌ها"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const handleExportAll = useCallback(async () => {
    const all = await fetchAllPages((p, ps) => adminGetWalletCustomers(p, ps, debouncedSearch));
    downloadCsv("wallet-customers.csv", buildCsv(columns, all));
  }, [columns, debouncedSearch]);

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-cocoa-900">کیف پول</h1>

      <div className="mt-4">
        <CashbackPercentForm />
      </div>

      <h2 className="mt-6 text-sm font-bold text-cocoa-900">موجودی مشتریان</h2>
      <div className="mt-3 overflow-hidden rounded-[1.5rem] border border-sand-100 bg-white">
        <CustomDataGrid<AdminCustomer>
          rows={customers}
          rowCount={total}
          columns={columns}
          loading={loading}
          onQueryChange={handleQueryChange}
          localeText={faDataGridLocaleText}
          exportFileName="wallet-customers"
          onExportAll={handleExportAll}
          filterMode="client"
          sortingMode="client"
          getRowHeight={() => 56}
          sx={{ border: "none", height: 720 }}
        />
      </div>

      <Dialog
        open={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        maxWidth="sm"
        fullWidth
        dir="rtl"
      >
        {selectedCustomer && (
          <>
            <DialogTitle className="font-display text-cocoa-900">
              تراکنش‌های کیف پول{" "}
              {[selectedCustomer.firstName, selectedCustomer.lastName]
                .filter(Boolean)
                .join(" ") || "بدون نام"}
            </DialogTitle>
            <DialogContent dividers>
              {!transactions ? (
                <p className="text-xs text-cocoa-500">در حال بارگذاری…</p>
              ) : transactions.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-xl bg-sand-50/60 p-3 text-xs"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-cocoa-900">
                          {WALLET_TRANSACTION_TYPE_LABELS[tx.type]}
                        </span>
                        <span className="text-cocoa-500">
                          {new Date(tx.createdAt).toLocaleDateString("fa-IR")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${tx.amount >= 0 ? "text-sand-500" : "text-danger-500"}`}
                        >
                          {tx.amount.toLocaleString("fa-IR")}
                          {tx.amount >= 0 ? "+" : ""} تومان
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-cocoa-500">تراکنشی ثبت نشده است</p>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </div>
  );
}

export default AdminWalletPage;
