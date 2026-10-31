"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Dialog, StatusMessage } from "../ui/primitives";
import type { ProjectItem } from "./projects-view";
import { trapDialogFocus } from "../ui/dialog-focus";

export default function ProjectDeleteDialog({ project, onDeleted, onClose }: {
  project: ProjectItem;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, { method: "DELETE" });
      if (!response.ok) {
        setError(response.status === 401
        ? "Your session has expired. Sign in again to delete this project."
        : response.status === 404
          ? "This project is unavailable or you no longer have access."
          : "Project could not be deleted. Try again.");
        return;
      }
      onDeleted();
    } catch {
      setError("Project could not be deleted. Check your connection and try again.");
    } finally { submitting.current = false; setBusy(false); }
  }

  return <Dialog ref={dialog} aria-labelledby="project-delete-title" aria-describedby="project-delete-description" tabIndex={-1} onKeyDown={trapDialogFocus} onClose={onClose} onCancel={event => { if (submitting.current) event.preventDefault(); }}>
    <form onSubmit={remove} aria-busy={busy} className="space-y-4">
      <h2 id="project-delete-title" className="text-xl font-semibold">Delete project?</h2>
      <p className="text-sm font-medium [overflow-wrap:anywhere]">{project.name}</p>
      <p id="project-delete-description" className="text-sm text-muted-foreground">This permanently deletes the project, its dataset metadata, saved validation summaries and mapping templates. This cannot be undone. CSV data in other open tabs remains browser-local.</p>
      {error && <StatusMessage tone="error">{error}</StatusMessage>}
      {busy && <p role="status" className="text-sm text-muted-foreground">Deleting project...</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button autoFocus type="button" disabled={busy} onClick={() => dialog.current?.close()}>Cancel</Button>
        <Button type="submit" variant="danger" pending={busy}>{busy ? "Deleting project..." : "Delete project"}</Button>
      </div>
    </form>
  </Dialog>;
}
