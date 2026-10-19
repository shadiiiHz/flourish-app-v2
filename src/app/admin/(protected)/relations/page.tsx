"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import type { GridColDef } from "@mui/x-data-grid";
import {
  ApiError,
  adminGetRelations,
  adminGetStockCandidates,
  adminSetProductDependents,
  apiUploadUrl,
  revalidateCatalog,
  type AdminRelation,
  type AdminStockCandidate,
} from "@/lib/api";
import { CustomDataGrid, type QueryType } from "@/components/admin/CustomDataGrid";
import { faDataGridLocaleText } from "@/components/admin/dataGridLocale";
import DependentProductsModal from "@/components/admin/DependentProductsModal";

/** How many dependents are named in a row before collapsing the rest into "+N". */
const VISIBLE_CHILDREN = 3;

/** Why a product can't become a brand-new parent, or null if it can. */
function newParentBlockedReason(c: AdminStockCandidate): string | null {
  if (c.dependentCount > 0) return "قبلاً در لیست ارتباطات است";
  if (c.stockSourceId) return "وابسته به محصول دیگری است";
  if (c.variantCount > 0) return "دارای انواع است";
  return null;
}

function AdminRelationsPage() {
  const [rows, setRows] = useState<AdminRelation[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  /** Every product, only for the picker modals — the table itself is paginated server-side. */
  const [candidates, setCandidates] = useState<AdminStockCandidate[]>([]);
  /** Parent whose dependents are being edited in the multi-select modal. */
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [pickingParent, setPickingParent] = useState(false);

  const fetchRows = useCallback(
    () =>
      adminGetRelations(page, pageSize, debouncedSearch).then((res) => {
        // Unlinking the last dependent of the only row on a page leaves it empty — step back a page.
        if (res.items.length === 0 && res.total > 0 && page > 1) {
          setPage(page - 1);
          return;
        }
        setRows(res.items);
        setTotal(res.total);
      }),
    [page, pageSize, debouncedSearch],
  );

  const fetchCandidates = useCallback(() => adminGetStockCandidates().then(setCandidates), []);

  const loadRows = useCallback(() => {
    setLoading(true);
    return fetchRows()
      .catch((err) => setError(err instanceof ApiError ? err.message : "خطا در دریافت اطلاعات"))
      .finally(() => setLoading(false));
  }, [fetchRows]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // The table pages through the server; the full product list for the pickers is loaded once.
  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    fetchCandidates().catch(() => setError("خطا در دریافت فهرست محصولات"));
  }, [fetchCandidates]);

  const handleQueryChange = useCallback((query: QueryType) => {
    setPage(query.page + 1);
    setPageSize(query.pageSize);
    setSearch((query.filterModel?.quickFilterValues ?? []).join(" "));
  }, []);

  const editingParent = editingParentId
    ? (rows.find((r) => r.id === editingParentId) ??
      candidates.find((c) => c.id === editingParentId))
    : undefined;
  const editingSelected = useMemo(
    () => candidates.filter((c) => c.stockSourceId === editingParentId).map((c) => c.id),
    [candidates, editingParentId],
  );

  const saveDependents = async (ids: string[]) => {
    if (!editingParentId) return;
    setError(null);
    try {
      await adminSetProductDependents(editingParentId, ids);
      await Promise.all([loadRows(), fetchCandidates()]);
      // Stock and availability of the dependents change on the cached storefront catalog.
      revalidateCatalog();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "خطا در ذخیره‌سازی");
    }
  };

  const columns = useMemo<GridColDef<AdminRelation>[]>(
    () => [
      {
        field: "title",
        headerName: "محصول مادر",
        flex: 1.5,
        minWidth: 300,
        renderCell: ({ row }) => (
          <div className="flex h-full items-center gap-3 py-1">
            <img
              src={row.image ? apiUploadUrl(row.image) : "/assets/placeholder.png"}
              alt=""
              className="h-11 w-11 shrink-0 rounded-xl border border-sand-100 object-cover"
            />
            <div className="min-w-0 whitespace-normal break-words">
              <p className="line-clamp-2 text-sm font-bold leading-snug text-cocoa-900">{row.title}</p>
              {row.categoryTitle && (
                <p className="mt-0.5 text-xs leading-snug text-cocoa-500">{row.categoryTitle}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        field: "stock",
        headerName: "موجودی",
        width: 110,
        valueGetter: (_, row) =>
          row.stock == null ? "نامحدود" : row.stock.toLocaleString("fa-IR"),
      },
      {
        field: "children",
        headerName: "محصولات وابسته",
        flex: 2,
        minWidth: 300,
        sortable: false,
        valueGetter: (_, row) => row.children.map((c) => c.title).join("، "),
        renderCell: ({ row }) => (
          <div className="flex h-full flex-wrap content-center items-center gap-1.5 py-1">
            <span className="rounded-full bg-sand-100 px-2 py-0.5 text-xs font-bold text-sand-600">
              {row.children.length.toLocaleString("fa-IR")}
            </span>
            {row.children.slice(0, VISIBLE_CHILDREN).map((c) => (
              <span
                key={c.id}
                className="max-w-[10rem] truncate rounded-full bg-sand-50 px-2.5 py-1 text-xs font-semibold text-cocoa-700"
              >
                {c.title}
              </span>
            ))}
            {row.children.length > VISIBLE_CHILDREN && (
              <span
                className="text-xs font-semibold text-cocoa-500"
                title={row.children
                  .slice(VISIBLE_CHILDREN)
                  .map((c) => c.title)
                  .join("، ")}
              >
                +{(row.children.length - VISIBLE_CHILDREN).toLocaleString("fa-IR")}
              </span>
            )}
          </div>
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
              onClick={() => setEditingParentId(row.id)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-sand-100 text-cocoa-700 transition hover:bg-sand-50"
              aria-label="ویرایش محصولات وابسته"
              title="ویرایش محصولات وابسته"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-cocoa-900">ارتباطات</h1>
          <p className="mt-1 text-xs text-cocoa-500">
            موجودی محصولات وابسته (فرزند) به‌صورت ۱ به ۱ از محصول مادر محاسبه می‌شود.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickingParent(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-sand-500 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(164,72,25,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Plus className="h-4 w-4" />
          ارتباط جدید
        </button>
      </div>

      {error && <p className="mt-3 text-xs font-semibold text-danger-500">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-sand-100 bg-white">
        <CustomDataGrid<AdminRelation>
          rows={rows}
          rowCount={total}
          columns={columns}
          loading={loading}
          onQueryChange={handleQueryChange}
          localeText={{
            ...faDataGridLocaleText,
            noRowsLabel: "هنوز ارتباطی تعریف نشده است",
          }}
          filterMode="client"
          sortingMode="client"
          getRowHeight={() => 80}
          exportFileName="relations"
          sx={{ border: "none", height: 700 }}
        />
      </div>

      {/* Step 1 of a new relation: choose the parent. */}
      <DependentProductsModal
        isOpen={pickingParent}
        parentId={null}
        title="انتخاب محصول مادر"
        description="محصولی که موجودی اصلی از آن محاسبه می‌شود"
        single
        confirmLabel="ادامه"
        getBlockedReason={newParentBlockedReason}
        candidates={candidates}
        selectedIds={[]}
        onConfirm={(ids) => {
          if (ids[0]) setEditingParentId(ids[0]);
        }}
        onClose={() => setPickingParent(false)}
      />

      {/* Step 2 / editing: choose the dependents of a parent. */}
      <DependentProductsModal
        isOpen={!!editingParentId}
        parentId={editingParentId}
        description={`موجودی محصولات انتخاب‌شده از «${editingParent?.title ?? ""}» محاسبه می‌شود (۱ به ۱)`}
        candidates={candidates}
        selectedIds={editingSelected}
        onConfirm={saveDependents}
        onClose={() => setEditingParentId(null)}
      />
    </div>
  );
}

export default AdminRelationsPage;
