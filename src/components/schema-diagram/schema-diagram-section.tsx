"use client";

import { useCallback, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import { buildWorkspaceSchemaDescriptor, isSchemaDescriptorCurrent } from "../../lib/schema-diagram/descriptor";
import type { SchemaDescriptorInput, WorkspaceSchemaDescriptor } from "../../lib/schema-diagram/types";
import type { RehearsalReportV1 } from "../../lib/rehearsal/types";
import SchemaDiagram from "./schema-diagram";
import SchemaDiagramExportControls from "./schema-diagram-export-controls";

export interface SchemaDiagramHandle { generate: () => boolean }
export interface SchemaDiagramSectionProps {
  configuration: SchemaDescriptorInput; report: RehearsalReportV1 | null; draftsPending: boolean; disabled: boolean; active: boolean;
  ref?: Ref<SchemaDiagramHandle>;
}
export default function SchemaDiagramSection({ configuration, report, draftsPending, disabled, active, ref }: SchemaDiagramSectionProps) {
  const [saved, setSaved] = useState<{ source: SchemaDescriptorInput; descriptor: WorkspaceSchemaDescriptor; sequence: number } | null>(null);
  const [error, setError] = useState("");
  const live = useRef<{ configuration: SchemaDescriptorInput; report: RehearsalReportV1 | null; draftsPending: boolean; disabled: boolean; active: boolean; saved: typeof saved } | null>(null);
  useLayoutEffect(() => {
    live.current = { configuration, report, draftsPending, disabled, active, saved };
    return () => { live.current = null; };
  }, [configuration, report, draftsPending, disabled, active, saved]);
  const exportCurrent = useCallback(() => {
    const current = live.current;
    return Boolean(current && saved && current.saved === saved && current.configuration === configuration && current.report === report && report &&
      saved.source === current.configuration && isSchemaDescriptorCurrent(saved.descriptor, current.configuration.identity) &&
      !current.draftsPending && !current.disabled && current.active);
  }, [saved, configuration, report]);
  useImperativeHandle(ref, () => ({ generate() {
    if (disabled || draftsPending || !report || !configuration.datasets.length) return false;
    try {
      const descriptor = buildWorkspaceSchemaDescriptor({ ...configuration, validation: { identity: configuration.identity, report } });
      setSaved(previous => ({ source: configuration, descriptor, sequence: (previous?.sequence ?? 0) + 1 })); setError(""); return true;
    } catch { setError("Unable to describe this configuration. Review the applied mappings and try again."); return false; }
  } }), [configuration, report, draftsPending, disabled]);
  const fresh = Boolean(saved && report && saved.source === configuration && isSchemaDescriptorCurrent(saved.descriptor, configuration.identity));
  // Report-only changes refresh annotations without resetting the retained canvas generation.
  const descriptor = useMemo(() => fresh && report ? buildWorkspaceSchemaDescriptor({ ...configuration, validation: { identity: configuration.identity, report } }) : saved?.descriptor,
    [fresh, configuration, report, saved]);
  return <section aria-labelledby="schema-diagram-heading" className="min-w-0 space-y-4 rounded-lg border border-border bg-surface p-4 sm:p-5">
    <h3 id="schema-diagram-heading" tabIndex={-1} className="scroll-mt-44 text-lg font-semibold outline-offset-2">Schema diagram</h3>
    {draftsPending ? <p role="status" className="rounded-lg border border-warning bg-warning-surface p-3 text-sm text-warning">Apply or cancel pending mapping/rule drafts before generating or inspecting the schema.</p>
      : !fresh ? <p role="status" className="text-sm text-muted-foreground">{saved ? "The configuration changed. Generate a new schema diagram." : "Choose Generate schema diagram to inspect the applied CSV configuration."}</p> : null}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {fresh && descriptor && !draftsPending && <>
      <p className="text-sm text-muted-foreground">Configured CSV schema · current validation: {descriptor.validationStatus}. The diagram does not establish import readiness.</p>
      {(descriptor.configurationState !== "DESCRIBED" || descriptor.validationStatus === "BLOCKED") && <p role="status" className="rounded-lg border border-warning bg-warning-surface p-3 text-sm text-warning">
        Draft schema view: {descriptor.validationStatus === "CONFIG_ERROR" ? "CONFIG_ERROR — configuration needs attention; row validity is unevaluated." : descriptor.validationStatus === "BLOCKED" ? "Validation is BLOCKED. Review its findings separately." : "Some declarations are incomplete or unresolved."}
      </p>}
      {!!descriptor.diagnostics.length && <details className="rounded-lg border border-border p-3"><summary className="min-h-11 cursor-pointer content-center font-semibold">Schema diagnostics ({descriptor.diagnostics.length})</summary>
        <ul aria-label="Schema configuration diagnostics" tabIndex={0} className="max-h-52 list-disc space-y-2 overflow-auto pl-5 text-sm [overflow-wrap:anywhere]">{descriptor.diagnostics.map(diagnostic =>
          <li key={diagnostic.id}>{diagnostic.code}{diagnostic.preflightCode && ` / ${diagnostic.preflightCode}`}{diagnostic.dataset !== null && ` · ${diagnostic.dataset}`}{diagnostic.column !== null && `.${diagnostic.column}`}</li>)}</ul>
      </details>}
      <SchemaDiagramExportControls descriptor={descriptor} isCurrent={exportCurrent} disabled={disabled || !active} />
    </>}
    {descriptor && saved && <div hidden={!fresh || draftsPending || !report || disabled}>
      <SchemaDiagram key={saved.sequence} descriptor={descriptor} active={active && fresh && !draftsPending && !disabled && Boolean(report)} />
    </div>}
  </section>;
}
