"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button, Dialog, LoadingState, StatusMessage } from "../ui/primitives";
import { trapDialogFocus } from "../ui/dialog-focus";
import { projectDate, projectResource, projectReportsHref, projectWorkspaceHref, templatesResource } from "../../lib/projects/presentation";
import { useProjectResource } from "./use-project-resource";
import ProjectReports from "./project-reports";

export default function ProjectDetails({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { state, retry } = useProjectResource(projectId, projectResource);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <Dialog ref={dialog} aria-labelledby="project-detail-title" tabIndex={-1} style={{ maxWidth: "48rem" }} onKeyDown={trapDialogFocus} onClose={onClose}>
    <div className="flex items-start justify-between gap-4 border-b border-border pb-4"><h2 id="project-detail-title" className="text-xl font-semibold">Project details</h2><Button autoFocus type="button" onClick={() => dialog.current?.close()}>Close</Button></div>
    <div className="mt-5">
      {state.phase === "loading" ? <LoadingState>Loading project details...</LoadingState> : state.phase === "error" ? <div className="space-y-3"><StatusMessage tone="error">{state.message}</StatusMessage><Button type="button" onClick={retry}>Retry project details</Button></div> : <>
        <h3 className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{state.value.project.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{state.value.project.description || "No description provided."}</p>
        <p className="mt-3 text-xs text-muted-foreground">Created {projectDate(state.value.project.createdAt)}</p>
        <nav aria-label="Project navigation" className="mt-5 flex flex-wrap gap-3">
          <Link href={projectWorkspaceHref(projectId)} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover">Open workspace</Link>
          <Link href={projectReportsHref(projectId)} className="inline-flex min-h-11 items-center rounded-lg border border-control-border px-4 py-2.5 text-sm font-medium hover:bg-surface-muted">Saved reports</Link>
          <Link href={projectWorkspaceHref(projectId)} className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-primary hover:underline">Use templates in workspace</Link>
        </nav>
        <div className="mt-6 grid gap-6 border-t border-border pt-5 md:grid-cols-2">
          <section aria-labelledby="project-detail-reports" className="min-w-0 space-y-4"><h3 id="project-detail-reports" className="font-semibold">Recent reports</h3><ProjectReports projectId={projectId} /></section>
          <section aria-labelledby="project-detail-templates" className="min-w-0 space-y-4"><h3 id="project-detail-templates" className="font-semibold">Mapping templates</h3><ProjectTemplates projectId={projectId} /></section>
        </div>
      </>}
    </div>
  </Dialog>;
}
function ProjectTemplates({ projectId }: { projectId: string }) {
  const { state, retry } = useProjectResource(projectId, templatesResource);
  if (state.phase === "loading") return <LoadingState className="p-3">Loading project templates...</LoadingState>;
  if (state.phase === "error") return <div className="space-y-3"><StatusMessage tone="error">{state.message}</StatusMessage><Button type="button" onClick={retry}>Retry project templates</Button></div>;
  const templates = state.value.templates;
  return <div className="space-y-3">
    <p className="text-sm text-muted-foreground">{templates.length} recent {templates.length === 1 ? "template" : "templates"} shown (up to 20).</p>
    {templates.length === 0 ? <p className="rounded-lg bg-surface-muted p-4 text-sm text-muted-foreground">No saved templates for this project.</p> :
      <ul aria-label="Project mapping templates" className="divide-y divide-border">{templates.slice(0, 5).map(template => <li key={template.id} className="min-w-0 py-3 first:pt-0"><p className="text-sm font-medium [overflow-wrap:anywhere]">{template.name}</p><time dateTime={template.updatedAt} className="mt-1 block text-xs text-muted-foreground">{projectDate(template.updatedAt)}</time></li>)}</ul>}
    {templates.length > 5 && <p className="text-xs text-muted-foreground">Showing 5 of {templates.length}. Manage the full list in the workspace.</p>}
    <p className="text-xs leading-relaxed text-muted-foreground">Templates store mapping configuration, not CSV rows. Open this project&apos;s workspace to apply or manage them.</p>
  </div>;
}
