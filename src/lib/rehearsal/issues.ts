
import type {
  IssueReference,
  RehearsalIssue,
} from "./types";

export type IssueDraft = Omit<
  RehearsalIssue,
  "id" | "relatedIssueIds" | "referencedRecords"
> & {
  referencedRecords?: readonly IssueReference[];
  relatedIssueIds?: readonly string[];
};

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareReferences(
  a: IssueReference,
  b: IssueReference
): number {
  return (
    compareText(a.dataset, b.dataset) ||
    a.rowNumber - b.rowNumber ||
    compareText(a.column ?? "", b.column ?? "")
  );
}

// Synchronous and identical in browsers and Node.js.
// This is not a security hash.
function fnv32(value: string, seed: number): string {
  let hash = seed >>> 0;

  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createIssue(
  input: IssueDraft
): RehearsalIssue {
  if (!input.dataset.trim() || !input.ruleId.trim()) {
    throw new Error(
      "Issue dataset and ruleId must be nonempty"
    );
  }

  if (
    input.rowNumber !== null &&
    (
      !Number.isSafeInteger(input.rowNumber) ||
      input.rowNumber < 1
    )
  ) {
    throw new Error(
      "Issue rowNumber must be a positive physical line or null"
    );
  }

  const identity = JSON.stringify([
    "v1",
    input.dataset,
    input.rowNumber,
    input.column,
    input.code,
    input.ruleId,
  ]);

  const id = `issue_${fnv32(identity, 0x811c9dc5)}${fnv32(identity, 0x9e3779b9)}`;

  return {
    ...input,
    id,
    referencedRecords: [
      ...(input.referencedRecords ?? []),
    ].sort(compareReferences),
    relatedIssueIds: [
      ...new Set(input.relatedIssueIds ?? []),
    ]
      .filter((related) => related !== id)
      .sort(compareText),
  };
}

export function finalizeIssues(
  issues: readonly RehearsalIssue[]
): RehearsalIssue[] {
  const sorted = [...issues].sort(
    (a, b) =>
      compareText(a.dataset, b.dataset) ||
      (a.rowNumber ?? -1) - (b.rowNumber ?? -1) ||
      compareText(a.column ?? "", b.column ?? "") ||
      compareText(a.code, b.code) ||
      compareText(a.ruleId, b.ruleId) ||
      compareText(a.id, b.id)
  );

  const seen = new Set<string>();

  for (const issue of sorted) {
    if (seen.has(issue.id)) {
      throw new Error(
        `Duplicate issue identity ${issue.id}; use a distinct ruleId for distinct constraints`
      );
    }

    seen.add(issue.id);
  }

  return sorted;
}
