import Link from "next/link";
import { Card } from "../ui/primitives";

/** Generic recovery never reveals whether a private resource exists. */
export default function NotFoundContent() {
  return <Card aria-labelledby="not-found-title" className="mx-auto w-full max-w-xl space-y-4">
    <p className="text-sm font-medium text-muted-foreground">404 / Page unavailable</p>
    <h1 id="not-found-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">Page not found</h1>
    <p className="text-sm leading-relaxed text-muted-foreground">This page is unavailable. It may have moved, or you may not have access. Check the address or use an existing workspace page.</p>
    <nav aria-label="Page recovery" className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
      <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">Back to Rowzen</Link>
      <Link href="/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-control-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-hover">Open dashboard</Link>
    </nav>
  </Card>;
}
