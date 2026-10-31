
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  findProjects: vi.fn(),
  findRuns: vi.fn(),
}));

vi.mock("../../src/lib/prisma", () => ({
  prisma: {
    project: { findMany: mocks.findProjects },
    validationRun: { findMany: mocks.findRuns },
  },
}));

import {
  getOwnedValidationHistory,
  RESULTS_HISTORY_LIMIT,
} from "../../src/lib/services/result-history";

beforeEach(() => {
  mocks.findProjects.mockReset();
  mocks.findRuns.mockReset();
});

describe("saved results history access and summaries", () => {
  it("rejects a missing authenticated user ID", async () => {
    await expect(
      getOwnedValidationHistory("")
    ).rejects.toThrow(/Authenticated user ID/);

    expect(mocks.findProjects).not.toHaveBeenCalled();
  });

  it("returns an empty state when the user owns no projects", async () => {
    mocks.findProjects.mockResolvedValue([]);

    expect(
      await getOwnedValidationHistory("user-A")
    ).toEqual([]);

    expect(mocks.findProjects).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-A" },
      }),
    );

    expect(mocks.findRuns).not.toHaveBeenCalled();
  });

  it("filters history to owned projects and limits query size", async () => {
    mocks.findProjects.mockResolvedValue([
      { id: "p1", name: "Project One" },
      { id: "p2", name: "Project Two" },
    ]);

    mocks.findRuns.mockResolvedValue([]);

    await getOwnedValidationHistory("user-A");

    expect(mocks.findRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: { in: ["p1", "p2"] },
        },
        orderBy: [
          { createdAt: "desc" },
          { id: "desc" },
        ],
        take: RESULTS_HISTORY_LIMIT,
      }),
    );
  });

  it("returns project names and summary metadata", async () => {
    const savedAt = new Date("2026-10-19T09:00:00Z");

    mocks.findProjects.mockResolvedValue([
      { id: "p1", name: "CSV Migration" },
    ]);

    mocks.findRuns.mockResolvedValue([
      {
        id: "run-1",
        projectId: "p1",
        status: "READY",
        totalRows: 6,
        validRows: 6,
        invalidRows: 0,
        issueCount: 0,
        createdAt: savedAt,
      },
    ]);

    const history =
      await getOwnedValidationHistory("user-A");

    expect(history).toEqual([
      {
        id: "run-1",
        projectId: "p1",
        projectName: "CSV Migration",
        status: "READY",
        totalRows: 6,
        validRows: 6,
        invalidRows: 0,
        issueCount: 0,
        createdAt: savedAt,
      },
    ]);

    expect(
      mocks.findRuns.mock.calls[0][0].select
    ).not.toHaveProperty("rawCsv");
  });
});
