import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "فلوریش | بوتیک نان و شیرینی",
  description: "فلوریش، بوتیک نان و شیرینی مدرن با محصولات دست‌ساز و تازه.",
  icons: {
    icon: "/assets/logo-placeholder.png",
  },
  other: {
    enamad: "184415467",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        {/* Loaded by the browser instead of next/font/google: next build on
            this server can't reliably reach fonts.googleapis.com at build
            time, but end users' browsers can. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}