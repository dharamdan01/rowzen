import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Sign in", description: "Sign in to Rowzen with GitHub or Google to open your CSV preflight projects. Validate, review and export without executing database imports." };

export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
