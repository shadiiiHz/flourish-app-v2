"use client";

import type { ReactNode } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { faIR } from "@mui/material/locale";
import CssBaseline from "@mui/material/CssBaseline";
import rtlPlugin from "stylis-plugin-rtl";
import { prefixer } from "stylis";

const theme = createTheme({
  direction: "rtl",
  cssVariables: true,
  palette: {
    primary: { main: "#a44819", light: "#ba6b26", dark: "#3e3f20", contrastText: "#ffffff" },
    error: { main: "#c1615a" },
    background: { default: "#ffffff", paper: "#ffffff" },
    text: { primary: "#000000", secondary: "#55532f" },
  },
  typography: {
    fontFamily: "var(--font-vazirmatn), Roboto, Helvetica, Arial, sans-serif",
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 700, boxShadow: "none" },
      },
    },
    MuiTextField: {
      defaultProps: { size: "small" },
    },
    MuiBackdrop: {
      styleOverrides: {
        // `invisible` backdrops belong to Popover/Menu/Select, not Dialog —
        // only blur the ones that actually render a visible dim overlay.
        root: ({ ownerState }) =>
          ownerState.invisible ? {} : { backdropFilter: "blur(4px)" },
      },
    },
  },
}, faIR);

export default function MuiAdminProvider({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "muirtl", stylisPlugins: [prefixer, rtlPlugin] }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
