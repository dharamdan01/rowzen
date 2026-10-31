
import { prisma } from "../../../../../lib/prisma";
import {
  getCurrentUser,
  getOwnedProject,
} from "../../../../../lib/security/authorization";
import { datasetSchema } from "../../../../../lib/services/schemas";
import {
  parseJson,
  unauthorized,
  notFound,
  databaseError,
} from "../../../../../lib/services/api";

export async function POST(
  request: Request,
  { params }: {
    params: Promise<{ projectId: string }>;
  }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const { projectId } = await params;
  const { data, error } = await parseJson(
    request,
    datasetSchema
  );

  if (error) return error;

  try {
    const project = await getOwnedProject(projectId, user.id);
    if (!project) return notFound();

    const dataset = await prisma.dataset.create({
      data: {
        name: data.name,
        rowCount: data.rowCount,
        projectId,
      },
    });

    return Response.json({ dataset }, { status: 201 });
  } catch (error) {
    return databaseError(error);
  }
}
