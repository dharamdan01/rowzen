import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), report: vi.fn() }));
vi.mock("../../src/lib/prisma", () => ({
  prisma: { validationRun: { findFirst: mocks.report } },
}));
vi.mock("../../src/lib/security/authorization", () => ({
  getCurrentUser: mocks.user,
}));
import { GET } from "../../src/app/api/reports/[id]/route";

const context = { params: Promise.resolve({ id: "report-A" }) };
const request = new Request("http://localhost/api/reports/report-A");

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "account-A" });
  mocks.report.mockResolvedValue(null);
});

describe("Phase 8 release: saved summary route ownership", () => {
  it("does not access the database when user is anonymous", async () => {
    mocks.user.mockResolvedValue(null);
    const response = await GET(request, context);
    expect(response.status).toBe(401);
    expect(mocks.report).not.toHaveBeenCalled();
  });
  it("enforces report id plus authenticated parent-project user id", async () => {
    await GET(request, context);
    expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "report-A", project: { userId: "account-A" } },
    }));
    expect(mocks.report.mock.calls[0][0].select).not.toHaveProperty("rows");
  });
  it("returns an indistinguishable 404 if report is not owned", async () => {
    const response = await GET(request, context);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Resource not found" });
  });
});
