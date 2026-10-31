import ProjectsView from "../../../components/projects/projects-view";
import { requireUser } from "../../../lib/security/authorization";
import { prisma } from "../../../lib/prisma";

export const instant = false;

export default async function ProjectsPage() {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, description: true },
  });

  return <ProjectsView projects={projects} />;
}
