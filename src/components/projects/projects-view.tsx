"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FolderOpen, Plus, Search } from "lucide-react";
import PageHeader from "../layout/page-header";
import { Button, Card, Input, Select, StatusMessage } from "../ui/primitives";
import ProjectEditor from "./project-editor";
import ProjectDeleteDialog from "./project-delete-dialog";
import ProjectDetails from "./project-details";
import { projectReportsHref, projectWorkspaceHref } from "../../lib/projects/presentation";

export type ProjectItem = { id: string; name: string; description?: string | null };
function matchesProject(project: ProjectItem, query: string) {
  return (project.name + " " + (project.description ?? "")).toLowerCase().includes(query);
}
export default function ProjectsView({ projects }: { projects: ProjectItem[] }) {
  const [items, setItems] = useState(projects);
  const [editing, setEditing] = useState<ProjectItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<ProjectItem | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState("newest");
  const newProjectButton = useRef<HTMLButtonElement>(null);
  const restoreAfterDeletion = useRef(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const restoreAfterEditor = useRef<"new" | "search" | null>(null);
  useEffect(() => {
    if (!editing && restoreAfterEditor.current) {
      const destination = restoreAfterEditor.current; restoreAfterEditor.current = null;
      if (destination === "search") searchInput.current?.focus(); else newProjectButton.current?.focus();
    }
  }, [editing]);
  useEffect(() => {
    if (!deleting && restoreAfterDeletion.current) {
      restoreAfterDeletion.current = false;
      newProjectButton.current?.focus();
    }
  }, [deleting]);
  const [status, setStatus] = useState("");
  const query = search.trim().toLowerCase();
  const filtered = items.filter(project => matchesProject(project, query));
  if (order === "name") filtered.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || a.id.localeCompare(b.id));
  return <section aria-labelledby="projects-title" className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6 [&>header]:max-w-xl [&>header]:border-0 [&>header]:pb-0">
      <PageHeader id="projects-title" title="Projects" description="Keep validation summaries and mapping templates together. Your CSV records stay in browser memory." />
      <Button ref={newProjectButton} type="button" variant="primary" onClick={() => setEditing("new")}><Plus aria-hidden="true" className="size-4" />New project</Button>
    </div>
    {status && <StatusMessage tone="success">{status}</StatusMessage>}
    {items.length === 0 ? <Card className="space-y-3 p-4 text-center sm:p-8">
      <FolderOpen aria-hidden="true" className="mx-auto size-7 text-muted-foreground" /><h2 className="text-lg font-semibold">No projects yet</h2>
      <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">Create a project to save validation summaries and mapping templates.</p>
      <Button type="button" onClick={() => setEditing("new")}>Create your first project</Button>
    </Card> : <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-md"><label htmlFor="project-search" className="mb-2 block text-sm font-medium">Search projects</label><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input ref={searchInput} id="project-search" type="search" maxLength={200} placeholder="Name or description" aria-describedby="project-result-count" className="pl-9" value={search} onChange={event => setSearch(event.target.value)} /></div></div>
        <label className="min-w-40 text-sm font-medium">Project order<Select className="mt-2" value={order} onChange={event => setOrder(event.target.value)}><option value="newest">Newest first</option><option value="name">Name (A–Z)</option></Select></label>
      </div>
      <p id="project-result-count" aria-live="polite" className="text-sm text-muted-foreground">{filtered.length} of {items.length} {items.length === 1 ? "project" : "projects"}</p>
      {filtered.length === 0 ? <Card className="space-y-3 text-center"><h2 className="text-lg font-semibold">No matching projects</h2><p className="text-sm text-muted-foreground">Try another name or description.</p><Button type="button" onClick={() => setSearch("")}>Clear search</Button></Card> :
        <ul aria-label="Projects" className="grid gap-4 md:grid-cols-2">
          {filtered.map(project => <li key={project.id} className="min-w-0">
            <Card className="flex h-full flex-col gap-4">
              <div className="flex min-w-0 items-start gap-3"><FolderOpen aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-muted-foreground" /><h2 className="text-lg font-semibold tracking-tight [overflow-wrap:anywhere]">{project.name}</h2></div>
              <p className="min-h-10 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{project.description || "No description provided."}</p>
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2">
                <Link href={projectWorkspaceHref(project.id)} aria-label={"Open " + project.name + " in workspace"} className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline">Open<ArrowUpRight aria-hidden="true" className="size-4" /></Link>
                <Link href={projectReportsHref(project.id)} aria-label={"Find saved reports for " + project.name} className="inline-flex min-h-11 items-center rounded-md text-sm font-medium hover:underline">Reports</Link>
                <Button type="button" aria-label={"Details for " + project.name} onClick={() => setDetails(project.id)}>Details</Button>
                <div className="ml-auto flex flex-wrap gap-2"><Button type="button" aria-label={"Edit " + project.name} onClick={() => setEditing(project)}>Edit</Button><Button type="button" variant="danger" aria-label={"Delete " + project.name} onClick={() => setDeleting(project)}>Delete</Button></div>
              </div>
            </Card>
          </li>)}
        </ul>}
    </>}
    {details && <ProjectDetails key={details} projectId={details} onClose={() => setDetails(null)} />}
    {deleting && <ProjectDeleteDialog project={deleting} onClose={() => setDeleting(null)} onDeleted={() => {
      setItems(current => current.filter(item => item.id !== deleting.id));
      setStatus("Project deleted.");
      restoreAfterDeletion.current = true;
      setDeleting(null);
    }} />}
    {editing && <ProjectEditor key={editing === "new" ? "new" : editing.id} project={editing === "new" ? null : editing}
      onClose={() => setEditing(null)} onSaved={saved => {
        restoreAfterEditor.current = editing === "new" ? "new" : query && !matchesProject(saved, query) ? "search" : null;
        setItems(current => current.some(item => item.id === saved.id) ? current.map(item => item.id === saved.id ? saved : item) : [saved, ...current]);
        setStatus(editing === "new" ? "Project created." : "Project updated.");
      }} />}
  </section>;
}
