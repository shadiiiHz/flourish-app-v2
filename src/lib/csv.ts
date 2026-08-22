import type { GridColDef, GridValidRowModel } from "@mui/x-data-grid";

/**
 * Renders one row's value for a column the same way the grid would: prefer
 * valueFormatter (falls back to the raw value via valueGetter/field), since
 * that's usually what already turns raw fields into the fa-IR/currency
 * strings shown on screen.
 */
function cellText<R extends GridValidRowModel>(row: R, column: GridColDef<R>): string {
  const rawValue = row[column.field as keyof R];
  const getter = column.valueGetter as
    | ((value: unknown, row: R, column: GridColDef<R>, apiRef: unknown) => unknown)
    | undefined;
  const formatter = column.valueFormatter as
    | ((value: unknown, row: R, column: GridColDef<R>, apiRef: unknown) => unknown)
    | undefined;
  const raw = getter ? getter(rawValue, row, column, undefined) : rawValue;
  const formatted = formatter ? formatter(raw, row, column, undefined) : raw;
  if (formatted === null || formatted === undefined) return "";
  return String(formatted);
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

const NON_EXPORTABLE_FIELDS = new Set(["__check__", "actions", "image", "images"]);

export function buildCsv<R extends GridValidRowModel>(columns: GridColDef<R>[], rows: R[]): string {
  const exportable = columns.filter((c) => !NON_EXPORTABLE_FIELDS.has(c.field));
  const header = exportable.map((c) => csvEscape(String(c.headerName ?? c.field))).join(",");
  const lines = rows.map((row) =>
    exportable.map((c) => csvEscape(cellText(row, c))).join(","),
  );
  // BOM so Excel opens Persian text as UTF-8 instead of mangling it.
  return "﻿" + [header, ...lines].join("\r\n");
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Server caps pageSize at 100 (see server/src/lib/pagination.ts), so "export all" pages through. */
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<{ items: T[]; total: number }>,
  pageSize = 100,
): Promise<T[]> {
  const first = await fetchPage(1, pageSize);
  const all = [...first.items];
  const totalPages = Math.ceil(first.total / pageSize);
  for (let page = 2; page <= totalPages; page++) {
    const next = await fetchPage(page, pageSize);
    all.push(...next.items);
  }
  return all;
}
