import { prisma } from "../../../../../../lib/prisma";
import { getCurrentUser, getOwnedProject } from "../../../../../../lib/security/authorization";
import { unauthorized, notFound, databaseError } from "../../../../../../lib/services/api";

type Context = { params: Promise<{ projectId: string; templateId: string }> };

export async function DELETE(_request: Request, { params }: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { projectId, templateId } = await params;
  try {
    if (!await getOwnedProject(projectId, user.id)) return notFound();
    const outcome = await prisma.mappingTemplate.deleteMany({
      where: { id: templateId, projectId },
    });
    if (outcome.count === 0) return notFound();
    return Response.json({ deleted: true });
  } catch (error) { return databaseError(error); }
}
