import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist } from "next/font/google";
import "./globals.css";
import { themeInitializationScript } from "../lib/theme/preference";
import { themeStyleSheet } from "../lib/theme/tokens";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Rowzen",
    template: "%s | Rowzen",
  },
  applicationName: "Rowzen",
  description:
    "Rowzen helps you validate CSV datasets, detect data quality issues, verify relationships, and assess readiness before database import.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <head>
        <style id="theme-tokens">{themeStyleSheet}</style>
        <script id="theme-initialization" dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
