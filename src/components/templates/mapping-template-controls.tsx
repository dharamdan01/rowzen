"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Input, Select, LoadingState } from "../ui/primitives";
import { checkTemplateCompatibility } from "../../lib/templates/workspace";
import { templateConfigurationSchema, type StoredMappingTemplate, type TemplateConfiguration } from "../../lib/templates/schema";
import type { ParsedCsv } from "../../lib/csv/parser";

type ProjectOption = { id: string; name: string };

type Props = {
  onPendingChange?: (pending: boolean) => void;
  projectId: string;
  projects: readonly ProjectOption[];
  projectSelectionDisabled?: boolean;
  onProjectChange: (id: string) => void;
  datasets: readonly ParsedCsv[];
  configuration: TemplateConfiguration | null;
  onLoad: (configuration: TemplateConfiguration) => void;
  onTemplateSelection?: (configuration: TemplateConfiguration | null) => void;
};

export default function MappingTemplateControls({
  projectId, projects, onProjectChange, datasets, configuration, onLoad, projectSelectionDisabled = false, onPendingChange, onTemplateSelection,
}: Props) {
  const [templates, setTemplates] = useState<StoredMappingTemplate[]>([]);
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [operation, setOperation] = useState<"save" | "delete" | null>(null);
  const busy = operation !== null;
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [listState, setListState] = useState({ projectId, phase: projectId ? "loading" : "idle", error: "" });
  const listPending = listState.projectId !== projectId || listState.phase === "loading";
  const listError = listState.projectId === projectId ? listState.error : "";
  const listUnavailable = listPending || Boolean(listError);
  const visibleTemplates = listUnavailable ? [] : templates;

  useEffect(() => {
    const selected = !listUnavailable && templates.find(template => template.id === selectedId && template.projectId === projectId);
    const checked = selected && templateConfigurationSchema.safeParse(selected.configuration);
    onTemplateSelection?.(checked && checked.success ? checked.data : null);
  }, [templates, selectedId, projectId, listUnavailable, onTemplateSelection]);

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    void fetch(`/api/projects/${encodeURIComponent(projectId)}/templates`, {
      cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Loading templates failed (HTTP ${response.status})`);
      const data = await response.json() as { templates?: StoredMappingTemplate[] };
      if (!Array.isArray(data.templates)) throw new Error("Could not read the template list. Retry loading templates.");
      return { templates: data.templates };
    }).then((response) => {
      if (!controller.signal.aborted) {
        setTemplates(response.templates);
        setSelectedId("");
        setListState({ projectId, phase: "ready", error: "" });
      }
    }).catch((caught: unknown) => {
      if (!controller.signal.aborted) setListState({ projectId, phase: "error", error: caught instanceof Error ? caught.message : "Could not load templates" });
    });
    return () => controller.abort();
  }, [projectId, retry]);

  async function saveTemplate() {
    if (!projectId || !configuration || !name.trim() || submitting.current || listUnavailable) return;
    submitting.current = true; onPendingChange?.(true);
    setOperation("save"); setStatus("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/templates`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), configuration }),
      });
      if (!response.ok) throw new Error(`Saving template failed (HTTP ${response.status})`);
      const { template } = await response.json() as { template: StoredMappingTemplate };
      setTemplates((existing) => [template, ...existing]);
      setSelectedId(template.id);
      setName("");
      setStatus("Template saved. No CSV rows or correction history were sent.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not save template");
    } finally { submitting.current = false; setOperation(null); onPendingChange?.(false); }
  }

  function loadTemplate() {
    if (listUnavailable) return;
    const entry = templates.find((template) => template.id === selectedId);
    if (!entry) return;
    const checked = templateConfigurationSchema.safeParse(entry.configuration);
    if (!checked.success) { setStatus("Template configuration is invalid."); return; }
    const compatibility = checkTemplateCompatibility(checked.data, datasets);
    if (!compatibility.ok) { setStatus(compatibility.reason); return; }
    if (!window.confirm("Load this template? Current mapping and validation settings will be replaced. CSV values and corrections will remain unchanged. Existing results will be cleared.")) return;
    setLoading(true);
    try {
      onLoad(checked.data);
      setStatus("Template applied. Run Validation to verify the new configuration.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not load template");
    } finally { setLoading(false); }
  }

  async function deleteTemplate() {
    if (!projectId || !selectedId || submitting.current || listUnavailable) return;
    const selected = templates.find((entry) => entry.id === selectedId);
    if (!selected || !window.confirm(`Delete template '${selected.name}' from this project?`)) return;
    submitting.current = true; onPendingChange?.(true);
    setOperation("delete"); setStatus("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/templates/${encodeURIComponent(selectedId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Deleting template failed (HTTP ${response.status})`);
      setTemplates((existing) => existing.filter((entry) => entry.id !== selectedId));
      setSelectedId("");
      setStatus("Template deleted. Uploaded CSV data and applied corrections are unchanged.");
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : "Could not delete template");
    } finally { submitting.current = false; setOperation(null); onPendingChange?.(false); }
  }

  return (
    <Card aria-label="Mapping and validation templates" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Mapping templates</h2>
        <p className="mt-1 text-sm text-muted-foreground">Save per-project schema mappings and validation settings. CSV rows, corrected values and correction history are never included.</p>
      </div>
      <label className="block text-sm font-medium">Template project
        <Select disabled={busy || projectSelectionDisabled} aria-label="Template project" className="mt-2 w-full sm:max-w-md" value={projectId} onChange={(event) => onProjectChange(event.target.value)}>
          <option value="">Choose project</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </Select>
      </label>
      {projectId && <>
        {listPending && <LoadingState className="p-3">Loading saved templates...</LoadingState>}
        {listError && <div className="space-y-2 rounded-lg border border-danger bg-danger-surface p-3 text-sm">
          <p role="alert">{listError} Your current CSV data and settings are unchanged.</p>
          <Button type="button" onClick={() => { setListState({ projectId, phase: "loading", error: "" }); setRetry(value => value + 1); }}>Retry loading templates</Button>
        </div>}
        {!listUnavailable && <p className="text-sm tabular-nums text-muted-foreground">{templates.length} of 20 template slots used in this project.</p>}
        {!listUnavailable && templates.length === 0 && <p role="status" className="text-sm text-muted-foreground">No saved templates for this project.</p>}
        <h3 className="border-t border-border pt-4 text-sm font-semibold">Save current settings</h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 basis-56 flex-1 text-sm font-medium">New template name
            <Input disabled={busy} aria-label="New template name" className="mt-2" value={name} maxLength={80} placeholder="Student import mapping" onChange={(event) => setName(event.target.value)} />
          </label>
          <Button type="button" pending={operation === "save"} disabled={!configuration || !name.trim() || busy || listUnavailable || templates.length >= 20} onClick={() => void saveTemplate()}>
            {operation === "save" ? "Saving template..." : "Save mapping template"}
          </Button>
        </div>
        <h3 className="border-t border-border pt-4 text-sm font-semibold">Reuse saved settings</h3>
        <label className="block text-sm font-medium">Saved mapping template
          <Select disabled={listUnavailable || busy} aria-label="Saved mapping template" className="mt-2 w-full sm:max-w-md" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
            <option value="">Choose template</option>
            {visibleTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </Select>
        </label>
        <div className="flex flex-wrap gap-3">
          <Button type="button" disabled={!selectedId || datasets.length === 0 || loading || busy || listUnavailable} onClick={loadTemplate}>Load mapping template</Button>
          <Button type="button" variant="danger" pending={operation === "delete"} disabled={!selectedId || busy || listUnavailable} onClick={() => void deleteTemplate()}>{operation === "delete" ? "Deleting template..." : "Delete mapping template"}</Button>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">To load a template, upload CSV files with matching dataset names and the same original headers in the same order. Changes to settings invalidate prior report verification.</p>
      </>}
      {busy && <p role="status" className="text-sm text-muted-foreground">{operation === "save" ? "Saving mapping template..." : "Deleting mapping template..."}</p>}
      {status && <p role="status" className="rounded-md border border-border p-3 text-sm [overflow-wrap:anywhere]">{status}</p>}
    </Card>
  );
}
