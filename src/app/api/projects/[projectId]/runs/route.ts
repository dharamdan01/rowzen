
import { prisma } from "../../../../../lib/prisma";
import {
  getCurrentUser,
  getOwnedProject,
} from "../../../../../lib/security/authorization";
import {
  validationRunSchema,
} from "../../../../../lib/services/schemas";
import {
  parseJson,
  unauthorized,
  notFound,
  databaseError,
} from "../../../../../lib/services/api";

type Context = {
  params: Promise<{ projectId: string }>;
};

export async function POST(
  request: Request,
  { params }: Context
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { projectId } = await params;
  const { data, error } = await parseJson(
    request,
    validationRunSchema
  );

  if (error) return error;

  try {
    const project = await getOwnedProject(projectId, user.id);
    if (!project) return notFound();

    const run = await prisma.validationRun.create({
      data: {
        projectId,
        status: data.status,
        totalRows: data.totalRows,
        validRows: data.validRows,
        invalidRows: data.invalidRows,
        issueCount: data.issueCount,
      },
    });

    return Response.json({ run }, { status: 201 });
  } catch (error) {
    return databaseError(error);
  }
}

export async function GET(
  _request: Request,
  { params }: Context
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { projectId } = await params;

  try {
    const project = await getOwnedProject(projectId, user.id);
    if (!project) return notFound();

    const runs = await prisma.validationRun.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return Response.json({ runs });
  } catch (error) {
    return databaseError(error);
  }
}
