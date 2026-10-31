
import { prisma } from "../../../../../lib/prisma";
import {
  getCurrentUser,
  getOwnedProject,
} from "../../../../../lib/security/authorization";
import { mappingSchema } from "../../../../../lib/services/schemas";
import {
  parseJson,
  unauthorized,
  notFound,
  databaseError,
} from "../../../../../lib/services/api";

export async function PUT(
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
    mappingSchema
  );

  if (error) return error;

  try {
    const project = await getOwnedProject(projectId, user.id);
    if (!project) return notFound();

    const datasetIds = [...new Set(
      data.mappings.map((mapping) => mapping.datasetId)
    )];

    const count = await prisma.dataset.count({
      where: {
        projectId,
        id: { in: datasetIds },
      },
    });

    if (count !== datasetIds.length) {
      return Response.json(
        { error: "Invalid project dataset reference" },
        { status: 400 }
      );
    }

    await prisma.project.updateMany({
      where: { id: projectId, userId: user.id },
      data: { mappings: data },
    });

    return Response.json({
      message: "Mappings saved",
      mappings: data,
    });
  } catch (error) {
    return databaseError(error);
  }
}
