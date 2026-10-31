"use client";
import { useEffect, useState } from "react";
import { readProjectResource, type ProjectResource } from "../../lib/projects/presentation";

type ResourceState<T> = { phase: "loading" } | { phase: "ready"; value: T } | { phase: "error"; message: string };
export function useProjectResource<T>(projectId: string, resource: ProjectResource<T>) {
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([projectId, resource.path, attempt]);
  const [snapshot, setSnapshot] = useState<{ key: string; state: ResourceState<T> } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void readProjectResource(projectId, resource, controller.signal).then(value => {
      if (!controller.signal.aborted) setSnapshot({ key, state: { phase: "ready", value } });
    }).catch(error => {
      if (!controller.signal.aborted) setSnapshot({ key, state: { phase: "error", message: error instanceof Error ? error.message : "Could not load project data." } });
    });
    return () => controller.abort();
  }, [projectId, resource, key]);
  const state: ResourceState<T> = snapshot?.key === key ? snapshot.state : { phase: "loading" };
  return { state, retry: () => setAttempt(value => value + 1) };
}
