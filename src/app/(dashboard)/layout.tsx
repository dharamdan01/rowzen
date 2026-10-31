import type { ReactNode } from "react";
import DashboardNav from "../../components/layout/dashboard-nav";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <DashboardNav />

      <div className="min-w-0 lg:pl-64">
        <main
          id="dashboard-content"
          tabIndex={-1}
          className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
