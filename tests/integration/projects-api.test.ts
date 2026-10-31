import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), owned: vi.fn(), create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() }));
vi.mock("../../src/lib/prisma", () => ({ prisma: { project: { create: mocks.create, findMany: mocks.findMany, updateMany: mocks.updateMany, deleteMany: mocks.deleteMany } } }));
vi.mock("../../src/lib/security/authorization", () => ({ getCurrentUser: mocks.user, getOwnedProject: mocks.owned }));
import { POST, GET } from "../../src/app/api/projects/route";
import { GET as GET_PROJECT, PATCH, DELETE } from "../../src/app/api/projects/[projectId]/route";
const context = { params: Promise.resolve({ projectId: "owned" }) };
const request = (body: unknown) => new Request("http://localhost/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "owner" }); mocks.create.mockResolvedValue({ id: "created", name: "Project" }); mocks.updateMany.mockResolvedValue({ count: 1 }); mocks.owned.mockResolvedValue({ id: "owned", name: "Updated" }); });
describe("existing project create/edit API contracts", () => {
  it("requires authentication for creation and editing", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await POST(request({ name: "Project" }))).status).toBe(401);
    expect((await PATCH(request({ name: "Updated" }), context)).status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("creates metadata using the authenticated owner", async () => {
    expect((await POST(request({ name: " Project ", description: " Description " }))).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({ data: { userId: "owner", name: "Project", description: "Description" } });
  });
  it("scopes edits by both project and owner", async () => {
    const response = await PATCH(request({ name: "Updated", description: "" }), context);
    expect(response.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: "owned", userId: "owner" }, data: { name: "Updated", description: "" } });
  });
  it("returns 404 without reading another owner's project", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });
    expect((await PATCH(request({ name: "Updated" }), context)).status).toBe(404);
    expect(mocks.owned).not.toHaveBeenCalled();
  });
  it.each([{ name: " " }, { name: "x".repeat(101) }, { name: "Valid", rawCsv: "private" }])("rejects invalid create/edit payloads", async body => {
    expect((await POST(request(body))).status).toBe(400);
    expect((await PATCH(request(body), context)).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.updateMany).not.toHaveBeenCalled();
  });
  it("lists only owned projects", async () => {
    mocks.findMany.mockResolvedValue([]); expect((await GET()).status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner" } }));
  });
});


describe("existing project delete API boundary", () => {
  it("rejects anonymous deletion before accessing the database", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await DELETE(new Request("http://localhost/api/projects/owned", { method: "DELETE" }), context)).status).toBe(401);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
  it("deletes only the requested authenticated owner's project", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 1 });
    const response = await DELETE(new Request("http://localhost/api/projects/owned", { method: "DELETE" }), context);
    expect(response.status).toBe(200);
    expect(mocks.deleteMany).toHaveBeenCalledExactlyOnceWith({ where: { id: "owned", userId: "owner" } });
  });
  it("returns 404 for missing or unowned projects without revealing details", async () => {
    mocks.deleteMany.mockResolvedValue({ count: 0 });
    const response = await DELETE(new Request("http://localhost/api/projects/owned", { method: "DELETE" }), context);
    expect(response.status).toBe(404);
    expect(mocks.owned).not.toHaveBeenCalled();
  });
});


describe("project detail read ownership", () => {
  it("requires a real session before reading any project", async () => {
    mocks.user.mockResolvedValue(null);
    expect((await GET_PROJECT(new Request("http://localhost/api/projects/owned"), context)).status).toBe(401);
    expect(mocks.owned).not.toHaveBeenCalled();
  });
  it("passes both project and authenticated owner to the existing gate", async () => {
    const response = await GET_PROJECT(new Request("http://localhost/api/projects/owned"), context);
    expect(response.status).toBe(200);
    expect(mocks.owned).toHaveBeenCalledExactlyOnceWith("owned", "owner");
  });
  it("does not distinguish missing and foreign projects", async () => {
    mocks.owned.mockResolvedValue(null);
    const response = await GET_PROJECT(new Request("http://localhost/api/projects/owned"), context);
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ error: "Resource not found" });
  });
});
