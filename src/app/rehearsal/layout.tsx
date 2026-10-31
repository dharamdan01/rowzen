import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "CSV demo", description: "Try your own CSV files with browser-local parsing and configurable preflight checks. No account, upload to a server or database import execution." };

export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
