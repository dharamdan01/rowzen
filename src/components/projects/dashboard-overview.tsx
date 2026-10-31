"use client";
import { useState } from "react";
import PageHeader from "../layout/page-header";
import Link from "next/link";
import { ArrowUpRight, FolderOpen } from "lucide-react";
import { Card, Select } from "../ui/primitives";
import type { ProjectItem } from "./projects-view";
import ProjectReports from "./project-reports";
import { projectWorkspaceHref } from "../../lib/projects/presentation";

const actionClass = "inline-flex min-h-11 items-center justify-center rounded-lg border border-control-border px-4 py-2.5 text-sm font-medium transition-colors duration-150 hover:bg-surface-muted motion-reduce:transition-none";
export default function DashboardOverview({ projects = [] }: { projects?: ProjectItem[] }) {
  const [selectedId, setSelectedId] = useState(projects[0]?.id ?? "");
  const selected = projects.find(project => project.id === selectedId) ?? projects[0];
  return <section aria-labelledby="dashboard-title" className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6 [&>header]:max-w-xl [&>header]:border-0 [&>header]:pb-0">
      <PageHeader id="dashboard-title" title="Dashboard" description="Pick up your project work. Review saved summaries, then prepare your next CSV validation." />
      <Link href="/upload" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary-hover motion-reduce:transition-none">Validate CSV files</Link>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card aria-labelledby="project-overview-title" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="project-overview-title" className="text-lg font-semibold">Recent projects</h2><Link href="/projects" className="inline-flex min-h-11 items-center rounded-md text-sm font-medium text-primary hover:underline">All projects</Link></div>
        <p className="text-sm text-muted-foreground"><span className="font-medium tabular-nums text-foreground">{projects.length}</span> recent {projects.length === 1 ? "project" : "projects"} shown. Most recently created, up to 3.</p>
        {projects.length ? <ul className="divide-y divide-border">{projects.map(project => <li key={project.id} className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-1 py-4 first:pt-0">
          <span className="flex min-w-0 flex-1 items-start gap-3 text-sm font-medium"><FolderOpen aria-hidden="true" className="mt-2.5 size-5 shrink-0 text-muted-foreground" /><span className="min-h-11 content-center [overflow-wrap:anywhere]">{project.name}</span></span>
          <Link href={projectWorkspaceHref(project.id)} aria-label={"Open " + project.name + " in workspace"} className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline">Open<ArrowUpRight aria-hidden="true" className="size-4" /></Link>
        </li>)}</ul> : <div className="rounded-lg bg-surface-muted p-4 text-sm"><p className="font-medium">No projects yet</p><p className="mt-2 leading-relaxed text-muted-foreground">Create a project to save summaries and reuse mappings, or validate CSV files directly.</p><Link href="/projects" className="mt-2 inline-flex min-h-11 items-center rounded-md font-medium text-primary hover:underline">Create a project</Link></div>}
        <Link href="/projects" className={actionClass}>View projects</Link>
      </Card>
      <Card aria-labelledby="dashboard-activity-title" className="space-y-5">
        <div><h2 id="dashboard-activity-title" className="text-lg font-semibold">Recent activity</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Saved validation summaries for a selected recent project.</p></div>
        {selected ? <><label className="block space-y-2 text-sm font-medium"><span>Activity project</span><Select value={selected.id} onChange={event => setSelectedId(event.target.value)}>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></label><ProjectReports projectId={selected.id} /></> : <p className="rounded-lg bg-surface-muted p-4 text-sm text-muted-foreground">No project activity to show. Create a project and save a validation summary to see it here.</p>}
      </Card>
    </div>
  </section>;
}
