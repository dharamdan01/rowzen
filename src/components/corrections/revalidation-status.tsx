import type { ReadinessStatus } from "../../lib/rehearsal/types";

export type RevalidationAction = "MANUAL" | "APPLY" | "UNDO" | "REDO" | "RESTORE";

const actionLabels: Record<RevalidationAction, string> = {
  MANUAL: "Manually validated current datasets",
  APPLY: "Automatically revalidated after applying a correction",
  UNDO: "Automatically revalidated after undo",
  REDO: "Automatically revalidated after redo",
  RESTORE: "Automatically revalidated after restoring original values",
};

/** Client-side verification only; not a claim about a real database import. */
export default function RevalidationStatus({ action, status }: {
  action: RevalidationAction;
  status: ReadinessStatus;
}) {
  return (
    <p
      data-testid="revalidation-status"
      role="status"
      className="rounded-lg border border-border bg-surface-muted p-3 text-sm leading-relaxed text-foreground"
    >
      {actionLabels[action]}. Readiness: {status.replaceAll("_", " ")}.
      {" "}Verified with the current in-browser Phase 6 preflight; no database import was executed.
    </p>
  );
}
