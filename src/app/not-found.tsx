import type { Metadata } from "next";
import RowzenBrand from "../components/brand/rowzen-brand";
import NotFoundContent from "../components/layout/not-found-content";
import ThemeSelector from "../components/theme/theme-selector";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This Rowzen page is unavailable. Return to an existing workspace page.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <div className="min-h-dvh bg-background text-foreground">
    <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
      <RowzenBrand href="/" className="inline-flex min-h-11 items-center gap-2 text-base font-semibold" />
      <ThemeSelector />
    </header>
    <main className="mx-auto flex min-h-[60vh] max-w-5xl items-center px-4 py-8 sm:px-6">
      <NotFoundContent />
    </main>
  </div>;
}
