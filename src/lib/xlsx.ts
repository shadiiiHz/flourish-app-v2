import type { GridColDef, GridValidRowModel } from "@mui/x-data-grid";

/**
 * Renders one row's value for a column the same way the grid would: prefer
 * valueFormatter (falls back to the raw value via valueGetter/field), since
 * that's usually what already turns raw fields into the fa-IR/currency
 * strings shown on screen.
 */
function cellText<R extends GridValidRowModel>(row: R, column: GridColDef<R>): string | number {
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
  // Real numbers stay numeric so Excel can sum/sort them; everything else is text.
  if (typeof formatted === "number" && Number.isFinite(formatted)) return formatted;
  return String(formatted);
}

const NON_EXPORTABLE_FIELDS = new Set(["__check__", "actions", "image", "images"]);

/** Builds a real .xlsx (one value per cell, RTL sheet) and downloads it. */
export async function downloadXlsx<R extends GridValidRowModel>(
  filename: string,
  columns: GridColDef<R>[],
  rows: R[],
): Promise<void> {
  const exportable = columns.filter((c) => !NON_EXPORTABLE_FIELDS.has(c.field));
  // Loaded lazily: exceljs is large and only needed when the admin exports.
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("Sheet1", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });

  sheet.columns = exportable.map((c) => ({
    header: String(c.headerName ?? c.field),
    key: c.field,
    width: 20,
    style: { alignment: { horizontal: "right", vertical: "middle", wrapText: true } },
  }));
  sheet.getRow(1).font = { bold: true };
  // Phone numbers etc. are strings in the data, so they keep leading zeros.
  for (const row of rows) {
    sheet.addRow(Object.fromEntries(exportable.map((c) => [c.field, cellText(row, c)])));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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
