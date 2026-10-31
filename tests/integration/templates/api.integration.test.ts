import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(), owned: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), deleteMany: vi.fn(),
}));
vi.mock("../../../src/lib/prisma", () => ({
  prisma: { mappingTemplate: { findMany: mocks.findMany, count: mocks.count, create: mocks.create, deleteMany: mocks.deleteMany } },
}));
vi.mock("../../../src/lib/security/authorization", () => ({
  getCurrentUser: mocks.currentUser, getOwnedProject: mocks.owned,
}));
// Use the real Zod parsing helper, including 64 KB body limit.
import { GET, POST } from "../../../src/app/api/projects/[projectId]/templates/route";
import { DELETE } from "../../../src/app/api/projects/[projectId]/templates/[templateId]/route";

const ctx = { params: Promise.resolve({ projectId: "own" }) };
const delCtx = { params: Promise.resolve({ projectId: "own", templateId: "T-1" }) };
const body = { name: "My template", configuration: {
  version: 1, datasets: [{ name: "students", headers: ["id"] }],
  mappings: { students: [{ source: "id", target: "id" }] },
  rules: { students: { primaryKey: "id", required: [], types: {} } },
  relationships: [], compositeRelationships: [], primaryOverrides: {}, uniqueSpecs: {},
} };
const request = (data: unknown) => new Request("http://localhost/api/projects/own/templates", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.currentUser.mockResolvedValue({ id: "user-A" });
  mocks.owned.mockResolvedValue({ id: "own", userId: "user-A" });
  mocks.count.mockResolvedValue(0);
  mocks.findMany.mockResolvedValue([]);
  mocks.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "T-1", ...data }));
  mocks.deleteMany.mockResolvedValue({ count: 1 });
});

describe("Phase 8 S7 project-owned mapping templates API", () => {
  it("returns 401 on unauthenticated GET", async () => {
    mocks.currentUser.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), ctx)).status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("returns 401 on unauthenticated POST", async () => {
    mocks.currentUser.mockResolvedValue(null);
    expect((await POST(request(body), ctx)).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("returns 404 when trying to save into someone else's project", async () => {
    mocks.owned.mockResolvedValue(null);
    expect((await POST(request(body), ctx)).status).toBe(404);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("scopes GET list by owned project id", async () => {
    const response = await GET(new Request("http://localhost"), ctx);
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: "own" }, take: 20 }));
  });
  it("persists only strict configuration into owned project", async () => {
    const response = await POST(request(body), ctx);
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({ data: { projectId: "own", name: "My template", configuration: body.configuration } });
  });
  it("rejects raw CSV content", async () => {
    expect((await POST(request({ ...body, configuration: { ...body.configuration, rows: [{ id: "sensitive" }] } }), ctx)).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("rejects correction history", async () => {
    expect((await POST(request({ ...body, correctionHistory: [] }), ctx)).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("enforces 20-template limit", async () => {
    mocks.count.mockResolvedValue(20);
    expect((await POST(request(body), ctx)).status).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("uses deleteMany scoped to both project and template", async () => {
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), delCtx)).status).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: "T-1", projectId: "own" } });
  });
  it("returns 404 for unknown template IDs", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), delCtx)).status).toBe(404);
  });
  it("rejects delete if project belongs to someone else", async () => {
    mocks.owned.mockResolvedValue(null);
    expect((await DELETE(new Request("http://localhost", { method: "DELETE" }), delCtx)).status).toBe(404);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
});
