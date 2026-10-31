
import { prisma } from "../../../lib/prisma";
import { getCurrentUser } from "../../../lib/security/authorization";
import { projectSchema } from "../../../lib/services/schemas";
import {
  parseJson,
  unauthorized,
  databaseError,
} from "../../../lib/services/api";

// POST /api/projects - Create project
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) return unauthorized();

  const { data, error } = await parseJson(
    request,
    projectSchema
  );

  if (error) return error;

  try {
    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        userId: user.id,
      },
    });

    return Response.json({ project }, { status: 201 });
  } catch (error) {
    return databaseError(error);
  }
}

// GET /api/projects - List own projects
export async function GET() {
  const user = await getCurrentUser();

  if (!user) return unauthorized();

  try {
    const projects = await prisma.project.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return Response.json({ projects });
  } catch (error) {
    return databaseError(error);
  }
}
