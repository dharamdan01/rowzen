"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Dialog, Input, StatusMessage, Textarea } from "../ui/primitives";
import type { ProjectItem } from "./projects-view";
import { trapDialogFocus } from "../ui/dialog-focus";

export default function ProjectEditor({ project, onSaved, onClose }: {
  project: ProjectItem | null;
  onSaved: (project: ProjectItem) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (!name.trim()) { setError("Enter a project name."); return; }
    submitting.current = true;
    setBusy(true); setError("");
    try {
      const response = await fetch(project ? `/api/projects/${encodeURIComponent(project.id)}` : "/api/projects", {
        method: project ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? "Your session has expired. Sign in again to save." : response.status === 404 ? "This project is unavailable or you no longer have access." : typeof data.error === "string" ? data.error : "Project could not be saved. Try again.");
      if (typeof data.project?.id !== "string" || typeof data.project?.name !== "string") throw new Error("The server did not return a saved project. Reload to check before trying again.");
      onSaved(data.project);
      dialog.current?.close();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Project could not be saved. Try again.");
    } finally { submitting.current = false; setBusy(false); }
  }

  return <Dialog ref={dialog} aria-labelledby="project-editor-title" tabIndex={-1} onKeyDown={trapDialogFocus} onClose={onClose} onCancel={event => { if (submitting.current) event.preventDefault(); }}>
    <form onSubmit={save} aria-busy={busy} className="space-y-4">
      <h2 id="project-editor-title" className="text-xl font-semibold">{project ? "Edit project" : "New project"}</h2>
      <label className="block space-y-2 text-sm font-medium">Project name
        <Input autoFocus required maxLength={100} value={name} onChange={event => setName(event.target.value)} disabled={busy} />
      </label>
      <label className="block space-y-2 text-sm font-medium">Description (optional)
        <Textarea maxLength={500} rows={3} value={description} onChange={event => setDescription(event.target.value)} disabled={busy} />
      </label>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {busy && <p role="status" className="text-sm text-muted-foreground">Saving project...</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</Button>
        <Button type="submit" variant="primary" pending={busy}>{busy ? "Saving project..." : project ? "Save changes" : "Create project"}</Button>
      </div>
    </form>
  </Dialog>;
}
