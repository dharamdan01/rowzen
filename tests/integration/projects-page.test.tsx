import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProjectsView from "../../src/components/projects/projects-view";

const mocks = vi.hoisted(() => ({ user: vi.fn(), findMany: vi.fn() }));
vi.mock("../../src/lib/prisma", () => ({ prisma: { project: { findMany: mocks.findMany } } }));
vi.mock("../../src/lib/security/authorization", () => ({ requireUser: mocks.user }));

import ProjectsPage from "../../src/app/(dashboard)/projects/page";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.mockResolvedValue({ id: "owner" });
});

describe("authenticated projects route", () => {
  it("connects the owned list to the existing interactive management view", async () => {
    const projects = [{ id: "owned-project", name: "Migration", description: "Metadata only" }];
    mocks.findMany.mockResolvedValue(projects);

    const page = await ProjectsPage();
    expect(page.type).toBe(ProjectsView);
    expect(page.props.projects).toEqual(projects);
    expect(mocks.findMany).toHaveBeenCalledExactlyOnceWith({
      where: { userId: "owner" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, description: true },
    });
    const html = renderToStaticMarkup(page);
    for (const label of ["New project", 'aria-label="Edit Migration"', 'aria-label="Delete Migration"']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('href="/upload?projectId=owned-project"');
    expect(html).toContain('href="/results?projectId=owned-project"');
  });

  it("keeps creation available when the owner has no projects", async () => {
    mocks.findMany.mockResolvedValue([]);
    const html = renderToStaticMarkup(await ProjectsPage());
    for (const text of ["No projects yet", "New project", "Create your first project"]) {
      expect(html).toContain(text);
    }
  });

  it("does not query projects when the authentication gate redirects", async () => {
    const redirect = new Error("authentication redirect");
    mocks.user.mockRejectedValue(redirect);
    await expect(ProjectsPage()).rejects.toBe(redirect);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("propagates a failed query to the existing error boundary", async () => {
    const failure = new Error("query unavailable");
    mocks.findMany.mockRejectedValue(failure);
    await expect(ProjectsPage()).rejects.toBe(failure);
  });
});
