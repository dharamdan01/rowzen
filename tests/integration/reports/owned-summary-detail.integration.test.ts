import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("../../../src/lib/prisma", () => ({ prisma: { validationRun: { findFirst: mocks.findFirst } } }));
import { getOwnedSummaryDetail } from "../../../src/lib/services/owned-summary-detail";

beforeEach(() => { mocks.findFirst.mockReset(); mocks.findFirst.mockResolvedValue(null); });
describe("Phase 8 S8 owner-scoped saved detail", () => {
  it("rejects unauthenticated user ID before database access", async () => {
    expect(await getOwnedSummaryDetail(" ", "run-1")).toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("rejects missing report ID before database access", async () => {
    expect(await getOwnedSummaryDetail("owner", " ")).toBeNull();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });
  it("filters report by both ID and authenticated project ownership", async () => {
    await getOwnedSummaryDetail("user-1", "run-7");
    const query = mocks.findFirst.mock.calls[0][0];
    expect(query.where).toEqual({ id: "run-7", project: { userId: "user-1" } });
  });
  it("does not select private CSV rows, issues, corrections or history", async () => {
    await getOwnedSummaryDetail("owner", "r1");
    const query = mocks.findFirst.mock.calls[0][0];
    expect(query.select).not.toHaveProperty("rows");
    expect(query.select).not.toHaveProperty("issues");
    expect(query.select).not.toHaveProperty("corrections");
    expect(query.select).not.toHaveProperty("rawCsv");
  });
  it("preserves CONFIG_ERROR null counts and date", async () => {
    const row = { id: "r", projectId: "p", project: { name: "Data" }, status: "CONFIG_ERROR", totalRows: 4, validRows: null, invalidRows: null, issueCount: 1, createdAt: new Date("2026-10-22T01:00:00Z") };
    mocks.findFirst.mockResolvedValue(row);
    await expect(getOwnedSummaryDetail("u", "r")).resolves.toEqual(row);
  });
});
