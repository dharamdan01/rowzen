import type { CorrectionState } from "../corrections/types";
import type { RehearsalReportV1 } from "../rehearsal/types";
import { isSchemaDescriptorCurrent } from "../schema-diagram/descriptor";
import { captureSchemaDiagramConfiguration } from "../schema-diagram/workspace";
import type { SchemaDescriptorIdentity, SchemaDescriptorInput } from "../schema-diagram/types";
import { mongoRecordsConsentSchema, mysqlRecordsConsentSchema, postgresRecordsConsentSchema, sameExportRevisions, type ExportRevisions } from "./contracts";
import type { ParsedCsv } from "../csv/parser";
import { buildDatabaseExportPlan } from "./plan";
import { DatabaseExportError } from "./types";
import type { DatabaseExportPlan } from "./types";

export interface DatabaseExportWorkspaceScope {
  /** Stable browser-local dataset/session token; never serialized or inspected. */
  readonly workspace: object;
  readonly configuration: SchemaDescriptorInput;
  readonly corrections: CorrectionState | null;
  /** Capture these bindings when the canonical report is produced, not during export. */
  readonly report: {
    readonly value: Pick<RehearsalReportV1, "status" | "issues">;
    readonly identity: SchemaDescriptorIdentity;
    readonly corrections: CorrectionState | null;
  } | null;
  readonly draftsPending: boolean;
}

/** Client-owned, in-memory scope. The owner must update it on every relevant transition. */
export function createDatabaseExportSession() {
  let scope: DatabaseExportWorkspaceScope | null = null;
  let configuration: SchemaDescriptorInput | null = null;
  let revisions: ExportRevisions = Object.freeze({ workspace: 0, configuration: 0, correction: 0, report: 0 });
  let generation = 0;
  let disposed = false;
  let cancelled = false;
  let reportScopeToken: DatabaseExportWorkspaceScope["report"] = null;
  const plans = new WeakMap<DatabaseExportPlan, number>();
  const reportRevisions = new WeakMap<object, ExportRevisions>();
  const ensureActive = () => { if (disposed) throw new DatabaseExportError("DISPOSED"); };
  return {
    update(next: DatabaseExportWorkspaceScope): ExportRevisions {
      ensureActive();
      // Configuration projection never touches rows, filenames, history or credentials.
      let captured: SchemaDescriptorInput;
      try { captured = captureSchemaDiagramConfiguration(next.configuration); }
      catch {
        generation++; scope = null; configuration = null; reportScopeToken = null;
        throw new DatabaseExportError("INVALID_CONFIGURATION");
      }
      const identityChanged = !configuration || !isSchemaDescriptorCurrent({ identity: configuration.identity }, captured.identity);
      const workspaceChanged = !scope || scope.workspace !== next.workspace || configuration?.identity.sessionId !== captured.identity.sessionId;
      const configurationChanged = !scope || scope.configuration !== next.configuration || identityChanged;
      const correctionChanged = !scope || scope.corrections !== next.corrections;
      const reportChanged = !scope || reportScopeToken !== next.report || scope.report?.value !== next.report?.value ||
        scope.report?.corrections !== next.report?.corrections || scope.report?.identity.sessionId !== next.report?.identity.sessionId ||
        scope.report?.identity.configurationKey !== next.report?.identity.configurationKey;
      if (workspaceChanged || configurationChanged || correctionChanged || reportChanged || scope?.draftsPending !== next.draftsPending) generation++;
      const previousRevisions = revisions;
      revisions = Object.freeze({ workspace: revisions.workspace + Number(workspaceChanged),
        configuration: revisions.configuration + Number(configurationChanged), correction: revisions.correction + Number(correctionChanged),
        report: revisions.report + Number(reportChanged) });
      const report = next.report;
      if (report && report.corrections === next.corrections && isSchemaDescriptorCurrent({ identity: report.identity }, captured.identity)) {
        const seen = reportRevisions.get(report.value);
        // Rewrapping the same current evidence is harmless; reviving old evidence is not.
        if (!seen || (sameExportRevisions(seen, previousRevisions) && !workspaceChanged && !configurationChanged &&
            !correctionChanged && scope?.report?.value === report.value)) {
          reportRevisions.set(report.value, revisions);
        }
      }
      configuration = captured;
      // Store only scope references. In particular, never clone/freeze/serialize corrections.
      reportScopeToken = next.report;
      scope = { workspace: next.workspace, configuration: next.configuration, corrections: next.corrections,
        report: next.report ? { value: next.report.value, identity: { ...next.report.identity }, corrections: next.report.corrections } : null,
        draftsPending: next.draftsPending };
      cancelled = false;
      return revisions;
    },
    getRevisions(): ExportRevisions { ensureActive(); return revisions; },
    prepare(input: unknown): DatabaseExportPlan {
      ensureActive();
      if (cancelled) throw new DatabaseExportError("CANCELLED");
      // A new request (including changed target/options/consent) supersedes prior work.
      generation++;
      if (!scope || !configuration) throw new DatabaseExportError("INVALID_CONFIGURATION");
      if (scope.report && (!isSchemaDescriptorCurrent({ identity: scope.report.identity }, configuration.identity) ||
          scope.report.corrections !== scope.corrections)) throw new DatabaseExportError("STALE");
      if (scope.report) {
        const captured = reportRevisions.get(scope.report.value);
        if (!captured || captured.workspace !== revisions.workspace || captured.configuration !== revisions.configuration ||
            captured.correction !== revisions.correction || captured.report !== revisions.report) throw new DatabaseExportError("STALE");
      }
      const plan = buildDatabaseExportPlan({ configuration: { ...configuration, validation: scope.report ?
        { identity: scope.report.identity, report: scope.report.value } : undefined }, revisions, draftsPending: scope.draftsPending }, input);
      plans.set(plan, generation);
      return plan;
    },
    assertCurrent(plan: DatabaseExportPlan): void {
      ensureActive();
      if (cancelled) throw new DatabaseExportError("CANCELLED");
      if (plans.get(plan) !== generation || !scope || scope.draftsPending) throw new DatabaseExportError("STALE");
    },
    withApprovedRecords<T>(plan: DatabaseExportPlan, consent: unknown, consume: (datasets: readonly ParsedCsv[]) => T): T {
      // Consent and freshness precede every access to raw/corrected records.
      this.assertCurrent(plan);
      const consentSchema = plan.manifest.target === "MONGODB" ? mongoRecordsConsentSchema :
        plan.manifest.target === "MYSQL" ? mysqlRecordsConsentSchema : postgresRecordsConsentSchema;
      const parsed = consentSchema.safeParse(consent);
      if (!parsed.success || !sameExportRevisions(parsed.data.revisions, plan.revisions) ||
          parsed.data.target !== plan.manifest.target || plan.status !== "PLANNED") throw new DatabaseExportError("INVALID_REQUEST");
      if (!scope?.corrections || !scope.report || scope.report.corrections !== scope.corrections) throw new DatabaseExportError("STALE");
      const report = scope.report.value;
      const onlyCycles = report.status === "BLOCKED" && report.issues.some(issue => issue.code === "DEPENDENCY_CYCLE") &&
        report.issues.every(issue => issue.severity !== "ERROR" || issue.code === "DEPENDENCY_CYCLE" && issue.category === "DEPENDENCY");
      if (!["READY", "READY_WITH_WARNINGS"].includes(report.status) && !onlyCycles) throw new DatabaseExportError("INVALID_CONFIGURATION");
      const result = consume(scope.corrections.current);
      this.assertCurrent(plan);
      return result;
    },
    cancel(): void { ensureActive(); generation++; cancelled = true; },
    dispose(): void { disposed = true; generation++; scope = null; configuration = null; reportScopeToken = null; },
  };
}
