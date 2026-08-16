"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  DataGrid,
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton,
  GridToolbarDensitySelector,
  GridToolbarQuickFilter,
  type DataGridProps,
  type GridRowId,
  type GridRowSelectionModel,
  type GridSortModel,
  type GridFilterModel,
  type GridValidRowModel,
} from "@mui/x-data-grid";

/**
 * With server-side pagination, MUI's header "select all" checkbox can't
 * enumerate every row across every page, so it flips the model to
 * `{ type: "exclude", ids }` — "everything is selected except these" —
 * instead of listing ids directly. Resolving it against the rows we
 * actually have loaded (the current page) turns that back into concrete,
 * deletable ids.
 */
export function resolveSelectedRowIds(
  model: GridRowSelectionModel,
  loadedRowIds: GridRowId[],
): string[] {
  if (model.type === "exclude") {
    return loadedRowIds.filter((id) => !model.ids.has(id)) as string[];
  }
  return Array.from(model.ids) as string[];
}

declare module "@mui/x-data-grid" {
  interface ToolbarPropsOverrides {
    selectedCount?: number;
    onBulkDelete?: () => void;
    bulkDeleteLabel?: string;
  }
}

export type OtherObjectsType = Record<string, unknown>;

export type QueryType = {
  sortModel?: GridSortModel;
  filterModel?: GridFilterModel;
  page: number;
  pageSize: number;
  otherObjects: OtherObjectsType;
};

interface BulkDeleteToolbarProps {
  selectedCount?: number;
  onBulkDelete?: () => void;
  bulkDeleteLabel?: string;
}

/** Same layout as MUI's built-in GridToolbar, with a bulk-delete action spliced in. */
function BulkDeleteToolbar({
  selectedCount = 0,
  onBulkDelete,
  bulkDeleteLabel = "حذف گروهی",
}: BulkDeleteToolbarProps) {
  return (
    <GridToolbarContainer>
      <GridToolbarColumnsButton />
      <GridToolbarFilterButton />
      <GridToolbarDensitySelector />
      {onBulkDelete && selectedCount > 0 && (
        <button
          type="button"
          onClick={onBulkDelete}
          className="mx-1 flex items-center gap-1.5 rounded-full bg-danger-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-[0_10px_20px_-8px_rgba(193,97,90,0.6)] transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {bulkDeleteLabel} ({selectedCount.toLocaleString("fa-IR")})
        </button>
      )}
      <div style={{ flex: 1 }} />
      <GridToolbarQuickFilter />
    </GridToolbarContainer>
  );
}

type CustomDataGridProps<R extends GridValidRowModel> = DataGridProps<R> &
  BulkDeleteToolbarProps & {
    onQueryChange: (tableState: QueryType) => void;
  };

export function CustomDataGrid<R extends GridValidRowModel>({
  onQueryChange,
  sx,
  selectedCount,
  onBulkDelete,
  bulkDeleteLabel,
  ...props
}: CustomDataGridProps<R>) {
  const defaultData = {
    page: props.initialState?.pagination?.paginationModel?.page ?? 0,
    pageSize: props.initialState?.pagination?.paginationModel?.pageSize ?? 10,
    sortModel: props.initialState?.sorting?.sortModel ?? [],
    filterModel: props.initialState?.filter?.filterModel ?? { items: [] },
  };
  const [queryState, setQueryState] = useState<QueryType>({
    sortModel: defaultData.sortModel,
    filterModel: defaultData.filterModel,
    page: defaultData.page,
    pageSize: defaultData.pageSize,
    otherObjects: {},
  });

  useEffect(() => {
    onQueryChange(queryState);
  }, [onQueryChange, queryState]);

  return (
    <DataGrid
      sortingMode="server"
      sortModel={queryState.sortModel}
      onSortModelChange={(model) =>
        setQueryState((prev) => ({ ...prev, sortModel: model }))
      }
      filterMode="server"
      filterModel={
        queryState.filterModel?.items?.length ||
        queryState.filterModel?.quickFilterValues?.length
          ? queryState.filterModel
          : { items: [] }
      }
      onFilterModelChange={(model) =>
        setQueryState((prev) => ({ ...prev, filterModel: model }))
      }
      paginationMode="server"
      pagination
      paginationModel={{ page: queryState.page, pageSize: queryState.pageSize }}
      onPaginationModelChange={({ page, pageSize }) =>
        setQueryState((prev) => ({ ...prev, page, pageSize }))
      }
      pageSizeOptions={[10, 20, 50, 100]}
      slots={{ toolbar: BulkDeleteToolbar }}
      slotProps={{ toolbar: { selectedCount, onBulkDelete, bulkDeleteLabel } }}
      showToolbar
      disableRowSelectionOnClick
      {...props}
      sx={{
        minHeight: 420,
        ...sx,

        "& .MuiDataGrid-scrollbar": {
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(120, 90, 65, 0.25) transparent",
        },

        "& .MuiDataGrid-scrollbar::-webkit-scrollbar": {
          width: "7px",
          height: "7px",
        },

        "& .MuiDataGrid-scrollbar::-webkit-scrollbar-track": {
          background: "transparent",
        },

        "& .MuiDataGrid-scrollbar::-webkit-scrollbar-thumb": {
          background: "rgba(120, 90, 65, 0.22)",
          borderRadius: "999px",
        },

        "& .MuiDataGrid-scrollbar::-webkit-scrollbar-thumb:hover": {
          background: "rgba(120, 90, 65, 0.4)",
        },
      }}
    />
  );
}
