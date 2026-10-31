import { impactFixture } from "./ai-impact-evidence";
import { createImpactEvidenceOwner } from "../../src/lib/ai/impact-evidence";
import { buildSmartRepairContext, resolveSmartRepairTarget, serializeSmartRepairContext, type SmartRepairWorkspaceSnapshot } from "../../src/lib/ai/smart-repair";
import type { SmartRepairIntent, SmartRepairRecommendation, SmartRepairWireContext } from "../../src/lib/ai/smart-repair-contracts";
import { createCorrectionState, getCurrentCellValue } from "../../src/lib/corrections/engine";
import type { CorrectionState } from "../../src/lib/corrections/types";
import { revalidateCorrectionSnapshot } from "../../src/lib/corrections/revalidation";
import type { RehearsalIssue } from "../../src/lib/rehearsal/types";
import type { FieldType } from "../../src/lib/rehearsal/rules";
import { buildWorkspaceKeyRules } from "../../src/lib/rehearsal/workspace-config";

/** Synthetic values only. Does not read user files or contact a database/model. */
export function repairCandidateFixture({ source = impactFixture({
  csv: { records: "id,flag,note\n001,yes,PRIVATE_NOTE\n002,no,PRIVATE_OTHER" },
  rules: { records: { primaryKey: "id", required: [], types: { flag: "boolean" } } },
}), intent = { kind: "CONFIRMED_BOOLEAN", convention: "YES_NO" },
select = issue => issue.code === "INVALID_TYPE", prepareState = state => state }: {
  source?: ReturnType<typeof impactFixture>;
  intent?: SmartRepairIntent;
  select?: (issue: RehearsalIssue) => boolean;
  prepareState?: (state: CorrectionState) => CorrectionState;
} = {}) {
  const corrections = prepareState(createCorrectionState(source.datasets)), configuration = source.configuration;
  const config = configuration ? { mappings: configuration.mappings, rules: configuration.rules,
    relationships: [...configuration.relationships, ...configuration.compositeRelationships],
    keyRules: buildWorkspaceKeyRules(configuration.rules, configuration.primaryOverrides, configuration.uniqueSpecs) } : null;
  const verified = config ? revalidateCorrectionSnapshot(corrections.current, config) : source.verified;
  const owner = createImpactEvidenceOwner();
  const evidence = owner.captureReport({ ...source, verified, expectedVersion: owner.getVersion() });
  let snapshot: SmartRepairWorkspaceSnapshot = { version: evidence.version, workspaceRevision: 0, evidence,
    report: verified.report, corrections, configuration, intent, draftsPending: false };
  const issue = snapshot.report.issues.find(select);
  if (!issue) throw new Error("Synthetic repair fixture must contain its selected issue");
  const getSnapshot = () => snapshot;
  const context = buildSmartRepairContext({ getSnapshot, issueId: issue.id });
  const wire: SmartRepairWireContext = JSON.parse(serializeSmartRepairContext(context));
  const envelope = { schemaVersion: 1 as const, requestId: wire.requestId, target: wire.target };
  const recommendation: SmartRepairRecommendation = wire.allowedStrategies.length
    ? { ...envelope, target: { ...wire.target, datasetId: wire.target.datasetId!, rowId: wire.target.rowId!, columnId: wire.target.columnId! },
      outcome: "ACTIONABLE_CANDIDATE", strategyId: wire.allowedStrategies[0] }
    : wire.inputRequests.length ? { ...envelope, outcome: "REQUIRES_USER_INPUT", input: wire.inputRequests[0] }
    : wire.guidanceOptions.length ? { ...envelope, outcome: "GUIDANCE_ONLY", guidance: wire.guidanceOptions[0] }
    : { ...envelope, outcome: "UNSUPPORTED_OR_INSUFFICIENT_EVIDENCE", reason: "UNSUPPORTED_TRANSFORMATION" };
  const target = resolveSmartRepairTarget(context, recommendation);
  const expectedValue = target.sourceColumn !== null && target.rowNumber !== null
    ? getCurrentCellValue(corrections, { dataset: target.dataset, rowNumber: target.rowNumber, column: target.sourceColumn }) : undefined;
  return { source, owner, config, context, wire, recommendation, expectedValue, getSnapshot,
    update: (patch: Partial<SmartRepairWorkspaceSnapshot>) => { snapshot = { ...snapshot, ...patch }; } };
}

export function normalizationFixture(value: string, type: FieldType = "boolean", intent: SmartRepairIntent = { kind: "CONFIRMED_BOOLEAN", convention: "YES_NO" }) {
  const quoted = `"${value.replaceAll('"', '""')}"`;
  return repairCandidateFixture({ intent, source: impactFixture({
    csv: { records: `id,flag,note\n001,${quoted},PRIVATE_NOTE` },
    rules: { records: { primaryKey: "id", required: ["flag"], types: { flag: type } } },
  }), select: issue => issue.column === "flag" });
}
