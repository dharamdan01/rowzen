import { prisma } from "../prisma";
import type { HistoryFilters } from "../reports/history-filters";
import { escapeHistorySearch } from "../reports/history-filters";

export async function getPaginatedOwnedValidationHistory(
  userId: string,
  filters: HistoryFilters,
) {
  if (!userId.trim()) throw new Error("Authenticated user ID is required");

  // Both count and rows are scoped to ownership AT QUERY TIME. Never accept
  // userId from URL parameters or derive ownership in the browser.
  const where = {
    project: {
      is: {
        userId,
        ...(filters.search
          ? { name: { contains: escapeHistorySearch(filters.search), mode: "insensitive" as const } }
          : {}),
      },
    },
    ...(filters.status !== "ALL" ? { status: filters.status } : {}),
  };

  const total = await prisma.validationRun.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const direction = filters.order === "oldest" ? "asc" as const : "desc" as const;

  const runs = await prisma.validationRun.findMany({
    where,
    select: {
      id: true,
      projectId: true,
      project: { select: { name: true } },
      status: true,
      totalRows: true,
      validRows: true,
      invalidRows: true,
      issueCount: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: direction }, { id: direction }],
    skip: (page - 1) * filters.pageSize,
    take: filters.pageSize,
  });

  return {
    total,
    totalPages,
    page,
    pageSize: filters.pageSize,
    items: runs.map(({ project, ...run }) => ({ ...run, projectName: project.name })),
  };
}

export type PaginatedValidationHistory = Awaited<ReturnType<typeof getPaginatedOwnedValidationHistory>>;
