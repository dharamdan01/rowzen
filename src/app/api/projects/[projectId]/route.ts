
import { prisma } from "../../../../lib/prisma";
import {
  getCurrentUser,
  getOwnedProject,
} from "../../../../lib/security/authorization";

import { updateProjectSchema } from "../../../../lib/services/schemas";

import {
  parseJson,
  unauthorized,
  notFound,
  databaseError,
} from "../../../../lib/services/api";

type Context = {
  params: Promise<{ projectId: string }>;
};

// GET /api/projects/:projectId
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

    return Response.json({ project });
  } catch (error) {
    return databaseError(error);
  }
}

// PATCH /api/projects/:projectId
export async function PATCH(
  request: Request,
  { params }: Context
) {
  const user = await getCurrentUser();

  if (!user) return unauthorized();

  const { projectId } = await params;

  const { data, error } = await parseJson(
    request,
    updateProjectSchema
  );

  if (error) return error;

  try {
    const result = await prisma.project.updateMany({
      where: {
        id: projectId,
        userId: user.id,
      },
      data,
    });

    if (result.count === 0) return notFound();

    const project = await getOwnedProject(projectId, user.id);

    return Response.json({ project });
  } catch (error) {
    return databaseError(error);
  }
}

// DELETE /api/projects/:projectId
export async function DELETE(
  _request: Request,
  { params }: Context
) {
  const user = await getCurrentUser();

  if (!user) return unauthorized();

  const { projectId } = await params;

  try {
    const result = await prisma.project.deleteMany({
      where: {
        id: projectId,
        userId: user.id,
      },
    });

    if (result.count === 0) return notFound();

    return Response.json({
      message: "Project deleted successfully",
    });
  } catch (error) {
    return databaseError(error);
  }
}
