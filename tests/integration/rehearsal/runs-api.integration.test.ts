import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  getOwnedProject: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: { validationRun: { create: mocks.create, findMany: mocks.findMany } },
}));
vi.mock("../../../src/lib/security/authorization", () => ({
  getCurrentUser: mocks.currentUser,
  getOwnedProject: mocks.getOwnedProject,
}));
vi.mock("../../../src/lib/services/api", () => ({
  parseJson: async (request: Request, schema: { safeParse: (input: unknown) => {
    success: boolean;
    data?: unknown;
  } }) => {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return { data: null, error: Response.json({ error: "Invalid input" }, { status: 400 }) };
    return { data: parsed.data, error: null };
  },
  unauthorized: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  notFound: () => Response.json({ error: "Not found" }, { status: 404 }),
  databaseError: () => Response.json({ error: "Database error" }, { status: 500 }),
}));

import { GET, POST } from "../../../src/app/api/projects/[projectId]/runs/route";

const ctx = { params: Promise.resolve({ projectId: "own-project" }) };
const makeRequest = (body: unknown) => new Request("http://localhost/api/projects/own-project/runs", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser.mockResolvedValue({ id: "user-A" });
  mocks.getOwnedProject.mockResolvedValue({ id: "own-project", userId: "user-A" });
  mocks.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "run-1", ...data,
  }));
  mocks.findMany.mockResolvedValue([]);
});

describe("owned summary-only validation runs API", () => {
  it("persists CONFIG_ERROR with null row validity and no CSV", async () => {
    const body = { status: "CONFIG_ERROR", totalRows: 6, validRows: null, invalidRows: null, issueCount: 1 };
    const response = await POST(makeRequest(body), ctx);
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({
      data: { projectId: "own-project", ...body },
    });
    expect(await response.json()).toMatchObject({ run: body });
  });

  it("persists READY_WITH_WARNINGS without altering status", async () => {
    const body = { status: "READY_WITH_WARNINGS", totalRows: 6, validRows: 6, invalidRows: 0, issueCount: 1 };
    const response = await POST(makeRequest(body), ctx);
    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({ data: { projectId: "own-project", ...body } });
  });

  it("rejects unrecognized raw CSV fields", async () => {
    const response = await POST(makeRequest({
      status: "READY", totalRows: 6, validRows: 6, invalidRows: 0, issueCount: 0,
      rawCsv: "id,name\\n1,Ada",
    }), ctx);
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not create a run without authentication", async () => {
    mocks.currentUser.mockResolvedValue(null);
    const response = await POST(makeRequest({ status: "READY", totalRows: 0, validRows: 0, invalidRows: 0, issueCount: 0 }), ctx);
    expect(response.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not save to a project the user does not own", async () => {
    mocks.getOwnedProject.mockResolvedValue(null);
    const response = await POST(makeRequest({ status: "READY", totalRows: 0, validRows: 0, invalidRows: 0, issueCount: 0 }), ctx);
    expect(response.status).toBe(404);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns owned history with preserved null values", async () => {
    const run = { id: "run-1", projectId: "own-project", status: "CONFIG_ERROR", totalRows: 6,
      validRows: null, invalidRows: null, issueCount: 2 };
    mocks.findMany.mockResolvedValue([run]);
    const response = await GET(new Request("http://localhost/api/projects/own-project/runs"), ctx);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ runs: [run] });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: "own-project" }, take: 50,
    }));
  });
});
