"use client";

import { useEffect, useState } from "react";
import {
  DataGrid,
  GridToolbar,
  type DataGridProps,
  type GridSortModel,
  type GridFilterModel,
  type GridValidRowModel,
} from "@mui/x-data-grid";

export type OtherObjectsType = Record<string, unknown>;

export type QueryType = {
  sortModel?: GridSortModel;
  filterModel?: GridFilterModel;
  page: number;
  pageSize: number;
  otherObjects: OtherObjectsType;
};

type CustomDataGridProps<R extends GridValidRowModel> = DataGridProps<R> & {
  onQueryChange: (tableState: QueryType) => void;
};

export function CustomDataGrid<R extends GridValidRowModel>({
  onQueryChange,
  sx,
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
      onSortModelChange={(model) => setQueryState((prev) => ({ ...prev, sortModel: model }))}
      filterMode="server"
      filterModel={
        queryState.filterModel?.items?.length || queryState.filterModel?.quickFilterValues?.length
          ? queryState.filterModel
          : { items: [] }
      }
      onFilterModelChange={(model) => setQueryState((prev) => ({ ...prev, filterModel: model }))}
      paginationMode="server"
      pagination
      paginationModel={{ page: queryState.page, pageSize: queryState.pageSize }}
      onPaginationModelChange={({ page, pageSize }) =>
        setQueryState((prev) => ({ ...prev, page, pageSize }))
      }
      pageSizeOptions={[10, 20, 50, 100]}
      slots={{ toolbar: GridToolbar }}
      showToolbar
      disableRowSelectionOnClick
      {...props}
      sx={{ height: 560, ...sx }}
    />
  );
}
