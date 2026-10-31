import { impactFixture, impactRelationship } from "./ai-impact-evidence";
import { createImpactEvidenceOwner } from "../../src/lib/ai/impact-evidence";
import { buildRootCauseContext, type RootCauseResponse } from "../../src/lib/ai/root-cause";

export function rootCauseFixture(kind: "key" | "required" | "reference" | "potential" | "cycle" | "config" | "empty" = "key") {
  const fixture = kind === "required" ? impactFixture({ csv: { records: "id,name\n1," }, rules: { records: { primaryKey: "id", required: ["name"], types: {} } } })
    : kind === "reference" ? impactFixture({ csv: { parent: "id\n1", child: "id\n2" }, relationships: [impactRelationship("child", "parent")] })
    : kind === "potential" ? impactFixture({ csv: { parent: "id\n1\n1", child: "id\n1" }, relationships: [impactRelationship("child", "parent")] })
    : kind === "cycle" ? impactFixture({ csv: { a: "id\n1", b: "id\n1" }, relationships: [impactRelationship("a", "b"), impactRelationship("b", "a")] })
    : kind === "config" ? impactFixture({ relationships: [impactRelationship("records", "missing_parent")] })
    : kind === "empty" ? impactFixture({ csv: { records: "id\n1" } }) : impactFixture();
  const owner = createImpactEvidenceOwner(), evidence = owner.captureReport({ ...fixture, expectedVersion: owner.getVersion() });
  const context = buildRootCauseContext(evidence);
  return { ...fixture, owner, evidence, context };
}
export const groundedKeyResponse: RootCauseResponse = { schemaVersion: 1, abstained: false, explanations: [
  { issueIds: ["i0", "i1"], cause: "KEY_REVIEW", investigation: "REVIEW_KEY_RECORDS", includePotentialImpact: false, uncertainty: "EVIDENCE_LIMITED" },
] };
