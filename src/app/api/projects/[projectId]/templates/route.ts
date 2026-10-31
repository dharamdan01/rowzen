import { prisma } from "../../../../../lib/prisma";
import { getCurrentUser, getOwnedProject } from "../../../../../lib/security/authorization";
import { parseJson, unauthorized, notFound, databaseError } from "../../../../../lib/services/api";
import { createMappingTemplateSchema } from "../../../../../lib/templates/schema";

const contextId = async (ctx: { params: Promise<{ projectId: string }> }) => (await ctx.params).projectId;
type Context = { params: Promise<{ projectId: string }> };

export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const projectId = await contextId(context);
  try {
    if (!await getOwnedProject(projectId, user.id)) return notFound();
    const templates = await prisma.mappingTemplate.findMany({
      where: { projectId }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: 20,
    });
    return Response.json({ templates });
  } catch (error) { return databaseError(error); }
}

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const projectId = await contextId(context);
  const { data, error } = await parseJson(request, createMappingTemplateSchema);
  if (error) return error;
  try {
    if (!await getOwnedProject(projectId, user.id)) return notFound();
    const count = await prisma.mappingTemplate.count({ where: { projectId } });
    if (count >= 20) return Response.json({ error: "Maximum 20 templates per project" }, { status: 409 });
    const template = await prisma.mappingTemplate.create({
      data: { projectId, name: data.name, configuration: data.configuration },
    });
    return Response.json({ template }, { status: 201 });
  } catch (error) { return databaseError(error); }
}
