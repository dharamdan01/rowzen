
import { prisma } from "../../../../lib/prisma";
import { getCurrentUser } from "../../../../lib/security/authorization";
import {
  unauthorized,
  notFound,
  databaseError,
} from "../../../../lib/services/api";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { id } = await params;

  try {
    const report = await prisma.validationRun.findFirst({
      where: {
        id,
        project: {
          userId: user.id,
        },
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
    });

    if (!report) return notFound();

    return Response.json({ report });
  } catch (error) {
    return databaseError(error);
  }
}
