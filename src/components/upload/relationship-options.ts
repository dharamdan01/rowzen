import type { ColumnMapping } from "../../lib/rehearsal/mapping";

/** Suggestions only: free-text entry and canonical FK validation remain unchanged. */
export function relationshipColumnOptions(mapping: readonly ColumnMapping[], current: readonly string[] = []): string[] {
  const prefix = current.slice(0,-1);
  const targets = [...new Set(mapping.map(entry => entry.target.trim()).filter(Boolean))];
  return targets.filter(target => !target.includes(",") && !prefix.includes(target))
    .map(target => [...prefix,target].join(", "));
}
