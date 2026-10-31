
import { prisma } from "../prisma";

// Latest reports across projects owned by the current user.
export const RESULTS_HISTORY_LIMIT = 50;

export async function getOwnedValidationHistory(userId: string) {
  if (!userId.trim()) {
    throw new Error("Authenticated user ID is required");
  }

  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });

  if (projects.length === 0) return [];

  const projectIds = projects.map((project) => project.id);

  const projectNames = new Map(
    projects.map((project) => [project.id, project.name] as const),
  );

  const runs = await prisma.validationRun.findMany({
    where: {
      projectId: { in: projectIds },
    },
    select: {
      id: true,
      projectId: true,
      status: true,
      totalRows: true,
      validRows: true,
      invalidRows: true,
      issueCount: true,
      createdAt: true,
    },
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
    take: RESULTS_HISTORY_LIMIT,
  });

  return runs.map((run) => ({
    ...run,
    projectName:
      projectNames.get(run.projectId) ?? "Unknown project",
  }));
}
