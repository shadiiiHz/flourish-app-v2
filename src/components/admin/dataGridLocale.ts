import { faIR } from "@mui/x-data-grid/locales";

export const faDataGridLocaleText = {
  ...faIR.components.MuiDataGrid.defaultProps.localeText,
  paginationDisplayedRows: ({ from, to, count }: { from: number; to: number; count: number }) =>
    `${from.toLocaleString("fa-IR")}–${to.toLocaleString("fa-IR")} از ${count.toLocaleString("fa-IR")}`,
};
