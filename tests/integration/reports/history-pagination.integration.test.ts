import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("../../../src/lib/prisma", () => ({
  prisma: { validationRun: { count: mocks.count, findMany: mocks.findMany } },
}));

import { parseHistoryFilters } from "../../../src/lib/reports/history-filters";
import { getPaginatedOwnedValidationHistory } from "../../../src/lib/services/paginated-results-history";

const row = (id: string, projectName = "Allowed project") => ({
  id, projectId: "owned-p1", project: { name: projectName },
  status: "CONFIG_ERROR", totalRows: 6, validRows: null,
  invalidRows: null, issueCount: 1, createdAt: new Date("2026-10-19T02:00:00Z"),
});

beforeEach(() => {
  mocks.count.mockReset();
  mocks.findMany.mockReset();
  mocks.count.mockResolvedValue(1);
  mocks.findMany.mockResolvedValue([row("r1")]);
});

describe("Phase 7 S6 authenticated paginated history", () => {
  it("rejects missing user without DB access", async () => {
    await expect(getPaginatedOwnedValidationHistory(" ", parseHistoryFilters({})))
      .rejects.toThrow(/Authenticated user ID/);
    expect(mocks.count).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("scopes both count and row fetch to authenticated owner", async () => {
    await getPaginatedOwnedValidationHistory("owner-1", parseHistoryFilters({}));
    const countWhere = mocks.count.mock.calls[0][0].where;
    const readWhere = mocks.findMany.mock.calls[0][0].where;
    expect(countWhere.project.is.userId).toBe("owner-1");
    expect(readWhere.project.is.userId).toBe("owner-1");
    expect(readWhere).toEqual(countWhere);
  });
  it("uses bounded, stable DB pagination and oldest-first ordering", async () => {
    mocks.count.mockResolvedValue(101);
    mocks.findMany.mockResolvedValue([]);
    const result = await getPaginatedOwnedValidationHistory("u", parseHistoryFilters({ page: "3", pageSize: "25", order: "oldest" }));
    expect(result).toMatchObject({ total: 101, totalPages: 5, page: 3, pageSize: 25 });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 50, take: 25, orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }));
  });
  it("clamps pages to valid range on final page", async () => {
    mocks.count.mockResolvedValue(12);
    const result = await getPaginatedOwnedValidationHistory("u", parseHistoryFilters({ page: "99" }));
    expect(result.page).toBe(2);
    expect(mocks.findMany.mock.calls[0][0].skip).toBe(10);
  });
  it("filters status and project name within owned projects", async () => {
    await getPaginatedOwnedValidationHistory("u", parseHistoryFilters({ status: "BLOCKED", q: "Test%_" }));
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({
      project: { is: { userId: "u", name: { contains: "Test\\%\\_", mode: "insensitive" } } },
      status: "BLOCKED",
    });
  });
  it("returns metadata only and keeps null row counts", async () => {
    const result = await getPaginatedOwnedValidationHistory("u", parseHistoryFilters({}));
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: "r1", projectName: "Allowed project", status: "CONFIG_ERROR", validRows: null, invalidRows: null });
    expect(result.items[0]).not.toHaveProperty("project");
    expect(mocks.findMany.mock.calls[0][0].select).not.toHaveProperty("rawCsv");
    expect(mocks.findMany.mock.calls[0][0].select).not.toHaveProperty("issues");
  });
  it("handles empty results without invalid pagination", async () => {
    mocks.count.mockResolvedValue(0);
    mocks.findMany.mockResolvedValue([]);
    const result = await getPaginatedOwnedValidationHistory("u", parseHistoryFilters({}));
    expect(result).toMatchObject({ total: 0, page: 1, totalPages: 1, items: [] });
  });
});
