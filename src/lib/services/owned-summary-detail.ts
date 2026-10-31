import { prisma } from "../prisma";

/** Read an individual stored summary through the user's owning project. */
export async function getOwnedSummaryDetail(userId: string, reportId: string) {
  if (!userId.trim() || !reportId.trim()) return null;
  return prisma.validationRun.findFirst({
    where: { id: reportId, project: { userId } },
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
  });
}
