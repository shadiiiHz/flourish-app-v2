"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Ban, CheckCircle2, Plus, Sparkles, Trash2 } from "lucide-react";
import type { GridColDef, GridRowSelectionModel } from "@mui/x-data-grid";
import {
  ApiError,
  adminBulkDeleteDiscountCodes,
  adminCreateManualDiscountCode,
  adminDeleteDiscountCode,
  adminGenerateDiscountCode,
  adminGetDiscountCodes,
  adminUpdateDiscountCode,
} from "@/lib/api";
import { buildCsv, downloadCsv, fetchAllPages } from "@/lib/csv";
import {
  CustomDataGrid,
  resolveSelectedRowIds,
  type QueryType,
} from "@/components/admin/CustomDataGrid";
import { faDataGridLocaleText } from "@/components/admin/dataGridLocale";
import ConfirmModal from "@/components/ConfirmModal";
import { digitsOnly } from "@/lib/formatNumber";
import type { AdminDiscountCode } from "@/types/admin";

type Mode = "manual" | "auto";

interface FormValues {
  mode: Mode;
  code: string;
  percent: string;
}

const EMPTY_FORM: FormValues = { mode: "manual", code: "", percent: "" };

const validationSchema = Yup.object({
  percent: Yup.number()
    .typeError("درصد تخفیف باید عدد باشد")
    .min(1, "درصد تخفیف باید حداقل ۱ باشد")
    .max(100, "درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد")
    .required("درصد تخفیف الزامی است"),
});

function AdminDiscountCodesPage() {
  const [codes, setCodes] = useState<AdminDiscountCode[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [deletingCode, setDeletingCode] = useState<AdminDiscountCode | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>(
    { type: "include", ids: new Set() },
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const selectedIds = useMemo(
    () =>
      resolveSelectedRowIds(
        selectionModel,
        codes.map((c) => c.id),
      ),
    [selectionModel, codes],
  );

  const fetchCodes = () =>
    adminGetDiscountCodes(page, pageSize, debouncedSearch).then((res) => {
      setCodes(res.items);
      setTotal(res.total);
    });

  const load = () => {
    setLoading(true);
    fetchCodes().finally(() => setLoading(false));
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    setLoading(true);
    fetchCodes().finally(() => setLoading(false));
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    setSelectionModel({ type: "include", ids: new Set() });
  }, [page, pageSize, debouncedSearch]);

  const handleQueryChange = useCallback((query: QueryType) => {
    setPage(query.page + 1);
    setPageSize(query.pageSize);
    setSearch((query.filterModel?.quickFilterValues ?? []).join(" "));
  }, []);

  const formik = useFormik<FormValues>({
    initialValues: EMPTY_FORM,
    validationSchema,
    onSubmit: async (values, helpers) => {
      setError(null);
      setCreatedCode(null);
      try {
        if (values.mode === "manual") {
          const code = values.code.trim();
          if (code.length < 3) {
            setError("کد تخفیف باید حداقل ۳ کاراکتر باشد");
            return;
          }
          const created = await adminCreateManualDiscountCode(code, Number(values.percent));
          setCreatedCode(created.code);
        } else {
          const created = await adminGenerateDiscountCode(Number(values.percent));
          setCreatedCode(created.code);
        }
        formik.resetForm({ values: EMPTY_FORM });
        load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "خطا در ذخیره‌سازی");
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  const toggleActive = async (row: AdminDiscountCode) => {
    try {
      await adminUpdateDiscountCode(row.id, { isActive: !row.isActive });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در بروزرسانی وضعیت");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminDeleteDiscountCode(id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف کد تخفیف");
    }
  };

  const handleBulkDelete = async () => {
    try {
      await adminBulkDeleteDiscountCodes(selectedIds);
      setSelectionModel({ type: "include", ids: new Set() });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در حذف گروهی");
    }
  };

  const columns = useMemo<GridColDef<AdminDiscountCode>[]>(
    () => [
      {
        field: "code",
        headerName: "کد تخفیف",
        flex: 1,
        minWidth: 140,
        renderCell: ({ row }) => (
          <span dir="ltr" className="font-mono font-bold text-cocoa-900">
            {row.code}
          </span>
        ),
      },
      {
        field: "percent",
        headerName: "درصد تخفیف",
        width: 120,
        valueGetter: (_, row) => `${row.percent.toLocaleString("fa-IR")}٪`,
      },
      {
        field: "isActive",
        headerName: "وضعیت",
        width: 110,
        valueFormatter: (_, row) => (row.isActive ? "فعال" : "غیرفعال"),
        renderCell: ({ row }) => (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              row.isActive
                ? "bg-sand-50 text-sand-500"
                : "bg-danger-50 text-danger-500"
            }`}
          >
            {row.isActive ? "فعال" : "غیرفعال"}
          </span>
        ),
      },
      {
        field: "createdAt",
        headerName: "تاریخ ایجاد",
        width: 130,
        valueGetter: (_, row) => new Date(row.createdAt).toLocaleDateString("fa-IR"),
      },
      {
        field: "actions",
        headerName: "عملیات",
        width: 120,
        sortable: false,
        filterable: false,
        align: "center",
        headerAlign: "center",
        renderCell: ({ row }) => (
          <div className="flex h-full w-full items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => toggleActive(row)}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                row.isActive
                  ? "border-danger-500/30 text-danger-500 hover:bg-danger-50"
                  : "border-sand-100 text-cocoa-700 hover:bg-sand-50"
              }`}
              aria-label={row.isActive ? "غیرفعال کردن" : "فعال کردن"}
              title={row.isActive ? "غیرفعال کردن" : "فعال کردن"}
            >
              {row.isActive ? (
                <Ban className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setDeletingCode(row)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-danger-500/30 text-danger-500 transition hover:bg-danger-50"
              aria-label="حذف"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  const handleExportAll = useCallback(async () => {
    const all = await fetchAllPages((p, ps) => adminGetDiscountCodes(p, ps, debouncedSearch));
    downloadCsv("discount-codes.csv", buildCsv(columns, all));
  }, [columns, debouncedSearch]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-cocoa-900">کدهای تخفیف</h1>
      </div>

      <form
        onSubmit={formik.handleSubmit}
        className="mt-4 rounded-[1.5rem] border border-sand-100 bg-white p-5"
      >
        <h2 className="text-sm font-bold text-cocoa-900">افزودن کد تخفیف جدید</h2>

        <div className="mt-3 flex w-fit gap-1 rounded-full border border-sand-100 bg-sand-50/60 p-1">
          <button
            type="button"
            onClick={() => formik.setFieldValue("mode", "manual")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
              formik.values.mode === "manual"
                ? "bg-sand-500 text-white"
                : "text-cocoa-600 hover:text-cocoa-900"
            }`}
          >
            کد دستی
          </button>
          <button
            type="button"
            onClick={() => formik.setFieldValue("mode", "auto")}
            className={`flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              formik.values.mode === "auto"
                ? "bg-sand-500 text-white"
                : "text-cocoa-600 hover:text-cocoa-900"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            تولید خودکار
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {formik.values.mode === "manual" && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-cocoa-600">
                کد تخفیف
              </label>
              <input
                dir="ltr"
                name="code"
                placeholder="مثلاً FLOURISH20"
                value={formik.values.code}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-semibold text-cocoa-600">
              درصد تخفیف
            </label>
            <input
              dir="ltr"
              inputMode="numeric"
              name="percent"
              placeholder="مثلاً ۲۰"
              value={formik.values.percent}
              onChange={(e) => formik.setFieldValue("percent", digitsOnly(e.target.value))}
              onBlur={formik.handleBlur}
              className="w-full rounded-xl border border-cocoa-900/10 px-3 py-2.5 text-sm outline-none focus:border-sand-400"
            />
            {formik.touched.percent && formik.errors.percent && (
              <p className="mt-1 text-xs font-semibold text-danger-500">
                {formik.errors.percent}
              </p>
            )}
          </div>
        </div>

        {formik.values.mode === "auto" && (
          <p className="mt-3 text-xs text-cocoa-500">
            کد تخفیف به صورت خودکار و یکتا تولید می‌شود؛ فقط کافی است درصد تخفیف را مشخص کنید.
          </p>
        )}

        {error && <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>}
        {createdCode && (
          <p className="mt-3 text-xs font-semibold text-sand-500">
            کد تخفیف ایجاد شد: <span dir="ltr" className="font-mono">{createdCode}</span>
          </p>
        )}

        <button
          type="submit"
          disabled={formik.isSubmitting}
          className="mt-4 flex items-center gap-1.5 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          {formik.isSubmitting ? "در حال ذخیره…" : "افزودن کد تخفیف"}
        </button>
      </form>

      <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-sand-100 bg-white">
        <CustomDataGrid<AdminDiscountCode>
          rows={codes}
          rowCount={total}
          columns={columns}
          loading={loading}
          onQueryChange={handleQueryChange}
          localeText={faDataGridLocaleText}
          filterMode="client"
          sortingMode="client"
          getRowHeight={() => 64}
          checkboxSelection
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={setSelectionModel}
          selectedCount={selectedIds.length}
          onBulkDelete={() => setBulkDeleteOpen(true)}
          exportFileName="discount-codes"
          onExportAll={handleExportAll}
          bulkDeleteLabel="حذف گروهی کدهای تخفیف"
          sx={{ border: "none", height: 800 }}
        />
      </div>

      <ConfirmModal
        isOpen={!!deletingCode}
        title="حذف کد تخفیف"
        description={
          deletingCode ? `آیا مطمئنید می‌خواهید کد تخفیف «${deletingCode.code}» را حذف کنید؟` : undefined
        }
        confirmLabel="بله، حذف شود"
        cancelLabel="انصراف"
        onConfirm={() => (deletingCode ? handleDelete(deletingCode.id) : undefined)}
        onClose={() => setDeletingCode(null)}
      />

      <ConfirmModal
        isOpen={bulkDeleteOpen}
        title="حذف گروهی کدهای تخفیف"
        description={`آیا مطمئنید می‌خواهید ${selectedIds.length.toLocaleString(
          "fa-IR",
        )} کد تخفیف را حذف کنید؟`}
        confirmLabel="بله، حذف شوند"
        cancelLabel="انصراف"
        onConfirm={handleBulkDelete}
        onClose={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}

export default AdminDiscountCodesPage;
