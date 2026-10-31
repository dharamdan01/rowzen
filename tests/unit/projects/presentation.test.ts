import { afterEach, describe, expect, it, vi } from "vitest";
import { projectResource, runsResource, templatesResource, readProjectResource, projectWorkspaceHref, projectReportsHref, projectReportHref } from "../../../src/lib/projects/presentation";
const signal = new AbortController().signal;
const run = { id: "r1", projectId: "p1", status: "CONFIG_ERROR", totalRows: 4, validRows: null, invalidRows: null, issueCount: 2, createdAt: "2026-10-27T00:00:00.000Z" };
afterEach(() => vi.unstubAllGlobals());
describe("existing project API presentation contracts", () => {
  it("retains unknown evaluated counts and strips configuration/records from UI state", () => {
    const parsed = runsResource.schema.parse({ runs: [{ ...run, rows: [{ secret: "PRIVATE_CELL" }] }] });
    expect(parsed.runs[0].validRows).toBeNull(); expect(JSON.stringify(parsed)).not.toContain("PRIVATE_CELL");
    const project = projectResource.schema.parse({ project: { id: "p1", name: "<script>", mappings: { secret: "PRIVATE_MAPPING" } } });
    expect(JSON.stringify(project)).not.toContain("PRIVATE_MAPPING"); expect(project.project.name).toBe("<script>");
  });
  it("rejects impossible counts and unsupported readiness instead of displaying zero", () => {
    expect(runsResource.schema.safeParse({ runs: [{ ...run, totalRows: -1 }] }).success).toBe(false);
    expect(runsResource.schema.safeParse({ runs: [{ ...run, status: "IMPORTED" }] }).success).toBe(false);
    expect(runsResource.schema.safeParse({ runs: [{ ...run, validRows: "0" }] }).success).toBe(false);
  });
  it("preserves exact project identities in workspace, report list and summary return links", () => {
    const id = "p/one?two#three";
    expect(projectWorkspaceHref(id)).toBe("/upload?projectId=p%2Fone%3Ftwo%23three");
    expect(projectReportsHref(id)).toBe("/results?projectId=p%2Fone%3Ftwo%23three");
    const link = new URL(projectReportHref(id, "r/1"), "https://local.invalid");
    expect(link.pathname).toBe("/results/r%2F1");
    expect(new URL(link.searchParams.get("returnTo")!, link.origin).searchParams.get("projectId")).toBe(id);
  });
  it("uses only the existing scoped endpoint and forwards cancellation/no-store", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ runs: [run] })); vi.stubGlobal("fetch", fetcher);
    expect((await readProjectResource("p1", runsResource, signal)).runs).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith("/api/projects/p1/runs", { cache: "no-store", signal });
  });
  it.each([401,404,500])("does not echo private error prose for HTTP %i", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "PRIVATE_SERVER_DETAIL" }, { status })));
    await expect(readProjectResource("p1", projectResource, signal)).rejects.not.toThrow("PRIVATE_SERVER_DETAIL");
  });
  it("rejects a valid-shaped response belonging to another project", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ runs: [{ ...run, projectId: "other" }] })));
    await expect(readProjectResource("p1", runsResource, signal)).rejects.toThrow(/verify/);
    expect(projectResource.belongsTo({ project: { id: "other", name: "Other" } }, "p1")).toBe(false);
    expect(templatesResource.belongsTo({ templates: [{ id: "t", projectId: "other", name: "Other", updatedAt: run.createdAt }] }, "p1")).toBe(false);
  });
  it("rejects malformed JSON without echoing its contents", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("PRIVATE_BROKEN_JSON")));
    await expect(readProjectResource("p1", projectResource, signal)).rejects.toThrow("Could not read project");
  });
  it("retains existing response limits and does not silently truncate unexpected output", () => {
    expect(runsResource.schema.safeParse({ runs: Array.from({ length: 51 }, () => run) }).success).toBe(false);
    expect(templatesResource.schema.safeParse({ templates: Array.from({ length: 21 }, (_, i) => ({ id: String(i), projectId: "p1", name: "Mapping", updatedAt: run.createdAt })) }).success).toBe(false);
  });
});
