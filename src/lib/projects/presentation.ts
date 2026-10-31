import { z } from "zod";
import { historyDetailHref, parseHistoryFilters } from "../reports/history-filters";

const date = z.string().refine(value => Number.isFinite(Date.parse(value)));
const project = z.object({ id: z.string().min(1), name: z.string(), description: z.string().nullable().optional(), createdAt: date.optional(), updatedAt: date.optional() });
const run = z.object({ id: z.string().min(1), projectId: z.string().min(1), status: z.enum(["READY", "READY_WITH_WARNINGS", "BLOCKED", "CONFIG_ERROR"]), totalRows: z.number().int().nonnegative(), validRows: z.number().int().nonnegative().nullable(), invalidRows: z.number().int().nonnegative().nullable(), issueCount: z.number().int().nonnegative(), createdAt: date });
const template = z.object({ id: z.string().min(1), projectId: z.string().min(1), name: z.string(), updatedAt: date });

export type ProjectMetadata = z.infer<typeof project>;
export type SavedProjectRun = z.infer<typeof run>;
export type SavedProjectTemplate = z.infer<typeof template>;
export interface ProjectResource<T> {
  readonly path: "" | "/runs" | "/templates";
  readonly label: string;
  readonly schema: z.ZodType<T>;
  readonly belongsTo: (value: T, projectId: string) => boolean;
}
export const projectResource: ProjectResource<{ project: ProjectMetadata }> = {
  path: "", label: "project", schema: z.object({ project }),
  belongsTo: (value, projectId) => value.project.id === projectId,
};
export const runsResource: ProjectResource<{ runs: SavedProjectRun[] }> = {
  path: "/runs", label: "saved reports", schema: z.object({ runs: z.array(run).max(50) }),
  belongsTo: (value, projectId) => value.runs.every(item => item.projectId === projectId),
};
export const templatesResource: ProjectResource<{ templates: SavedProjectTemplate[] }> = {
  path: "/templates", label: "templates", schema: z.object({ templates: z.array(template).max(20) }),
  belongsTo: (value, projectId) => value.templates.every(item => item.projectId === projectId),
};
/** Existing owner-checked endpoints only. Strip unused configuration and never persist responses. */
export async function readProjectResource<T>(projectId: string, resource: ProjectResource<T>, signal: AbortSignal): Promise<T> {
  const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + resource.path, { cache: "no-store", signal });
  if (response.status === 401) throw new Error("Your session has expired. Sign in again.");
  if (response.status === 404) throw new Error("This project is unavailable or you no longer have access.");
  if (!response.ok) throw new Error("Could not load " + resource.label + ". Try again.");
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error("Could not read " + resource.label + ". Retry to load current data."); }
  const result = resource.schema.safeParse(payload);
  if (!result.success || !resource.belongsTo(result.data, projectId)) throw new Error("Could not verify " + resource.label + " for this project. Retry to load current data.");
  return result.data;
}
export function projectWorkspaceHref(projectId: string) { return "/upload?projectId=" + encodeURIComponent(projectId); }
export function projectReportsHref(projectId: string) { return "/results?projectId=" + encodeURIComponent(projectId); }
export function projectReportHref(projectId: string, reportId: string) {
  return historyDetailHref(reportId, parseHistoryFilters({ projectId }), 1);
}
const formatter = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Karachi" });
export function projectDate(value?: string): string { return value ? formatter.format(new Date(value)) : "Date unavailable"; }
